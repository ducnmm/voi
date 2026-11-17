#!/usr/bin/env python3
"""Voi HTTP handoff client. No dependencies; never prints integration credentials."""
import argparse
import datetime as dt
import email.utils
import json
import os
from pathlib import Path
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def load_json(path):
    with open(path, encoding="utf-8") as stream:
        return json.load(stream)


def origin_url(value):
    parsed = urllib.parse.urlsplit(value)
    local = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if (parsed.scheme != "https" and not local) or not parsed.hostname or parsed.username or parsed.password or parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise ValueError("apiOrigin must be an HTTPS origin (HTTP localhost allowed for development)")
    return value.rstrip("/")


def check_payload(payload, config):
    """Preflight identity/scope checks; backend remains the full schema authority."""
    if set(payload) - {"schemaVersion", "runId", "dryRun", "items"} or payload.get("schemaVersion") != 1:
        raise ValueError("Use only the Voi schemaVersion=1 batch envelope")
    if not isinstance(payload.get("runId"), str) or not 1 <= len(payload["runId"]) <= 128:
        raise ValueError("runId is required (1..128 characters)")
    items = payload.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 25:
        raise ValueError("Each payload must contain 1..25 items")
    sources = {source["sourceId"]: source for source in config.get("sources", [])}
    areas = {area["code"] for area in config.get("areas", [])}
    operations = set()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"Item {index}: object required")
        operation = item.get("operationId")
        if not isinstance(operation, str) or not 1 <= len(operation) <= 128 or operation in operations:
            raise ValueError(f"Item {index}: operationId missing, too long, or duplicated")
        operations.add(operation)
        source = sources.get(item.get("sourceId"))
        if not source or not re.fullmatch(r"[0-9]+", str(source.get("externalGroupId", ""))):
            raise ValueError(f"Item {index}: source missing from runtime config, or group ID is not numeric")
        post = item.get("sourcePostId", "")
        if not isinstance(post, str) or not re.fullmatch(r"[0-9]{1,40}", post):
            raise ValueError(f"Item {index}: numeric sourcePostId required")
        expected_path = f"/groups/{source['externalGroupId']}/posts/{post}/"
        url = urllib.parse.urlsplit(item.get("sourceUrl", ""))
        alternate = expected_path.replace("/posts/", "/permalink/")
        if url.scheme != "https" or url.hostname not in {"facebook.com", "www.facebook.com", "m.facebook.com", "mbasic.facebook.com"} or url.username or url.password or url.port or url.path.rstrip("/") not in {expected_path.rstrip("/"), alternate.rstrip("/")}:
            raise ValueError(f"Item {index}: sourceUrl must use configured numeric group ID and matching post ID")
        action = item.get("action")
        if action not in {"UPSERT", "SOURCE_DELETED"}:
            raise ValueError(f"Item {index}: invalid action")
        if action == "UPSERT":
            listing = item.get("listing", {})
            if listing.get("areaCode") is not None and listing["areaCode"] not in areas:
                raise ValueError(f"Item {index}: areaCode not configured")
            if listing.get("scheduleKind", "SINGLE") not in {"SINGLE", "MULTIPLE", "RECURRING", "UNCLEAR"}:
                raise ValueError(f"Item {index}: invalid scheduleKind")
    if len(json.dumps(payload, ensure_ascii=False).encode()) > 1024 * 1024:
        raise ValueError("Payload exceeds API's 1 MiB limit")


def retry_delay(attempt, retry_after):
    delays = (2, 5, 15, 30, 60)
    delay = delays[min(attempt, 4)] + random.uniform(0, 1)
    if retry_after:
        try:
            server_delay = float(retry_after)
        except ValueError:
            try:
                when = email.utils.parsedate_to_datetime(retry_after)
                server_delay = (when - dt.datetime.now(dt.timezone.utc)).total_seconds()
            except (ValueError, TypeError, OverflowError):
                server_delay = 0
        delay = max(delay, server_delay)
    return max(0, delay)


def request_json(origin, token, method, path, payload=None):
    # Serialize exactly once: every automatic retry uses the same request body.
    data = None if payload is None else json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    opener = urllib.request.build_opener(NoRedirect)
    for attempt in range(6):
        retry_after = None
        transient = False
        req = urllib.request.Request(origin + path, data=data, method=method, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept": "application/json"})
        try:
            with opener.open(req, timeout=35) as response:
                body = json.load(response)
            transient = isinstance(body, dict) and any(item.get("outcome") == "retryable_error" for item in body.get("results", []))
            if not transient or attempt == 5:
                return body
        except urllib.error.HTTPError as error:
            transient = error.code == 429 or 500 <= error.code <= 599
            retry_after = error.headers.get("Retry-After")
            if not transient or attempt == 5:
                raise ValueError(f"API HTTP {error.code}; no credentials or response body printed") from None
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
            transient = True
            if attempt == 5:
                raise ValueError("Network failure after bounded retries; keep original payload for later replay") from None
        if transient:
            delay = retry_delay(attempt, retry_after)
            print(f"Transient API result; retry {attempt + 1}/5 after {delay:.1f}s using unchanged payload", file=sys.stderr)
            time.sleep(delay)
    raise ValueError("Retry limit reached")


def read_token(args):
    token = Path(args.key_file).read_text(encoding="utf-8").strip() if args.key_file else os.environ.get("VOI_INTEGRATION_KEY", "").strip()
    if not re.fullmatch(r"voi_int\.[\w-]+\.[\w-]+", token):
        raise ValueError("A valid --key-file or VOI_INTEGRATION_KEY is required")
    return token


def print_result(value):
    print(json.dumps(value, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate", "batch", "get", "recheck"])
    parser.add_argument("--config", required=True)
    parser.add_argument("--key-file", help="Secret file; alternatively VOI_INTEGRATION_KEY")
    parser.add_argument("--file", help="Prepared Voi batch JSON")
    parser.add_argument("--apply", action="store_true", help="Apply batch; default is dryRun")
    parser.add_argument("--id", help="Voi listing ID for get")
    parser.add_argument("--source-id", help="Configured source ID for recheck")
    parser.add_argument("--cursor", help="Unmodified nextCursor for recheck pagination")
    args = parser.parse_args()
    config = load_json(args.config)
    origin = origin_url(config.get("apiOrigin", "https://api-voi.up.railway.app"))
    if args.command in {"batch", "validate"}:
        if not args.file:
            raise ValueError("--file required")
        payload = load_json(args.file)
        check_payload(payload, config)
        if args.command == "validate":
            print_result({"preflightValid": True, "items": len(payload["items"]), "note": "No network call; full validation happens during API dryRun"})
            return 0
    token = read_token(args)
    base = "/v1/integrations/community-listings"
    if args.command == "get":
        if not args.id:
            raise ValueError("--id required")
        print_result(request_json(origin, token, "GET", base + "/" + urllib.parse.quote(args.id, safe="")))
        return 0
    if args.command == "recheck":
        if args.source_id not in {source["sourceId"] for source in config.get("sources", [])}:
            raise ValueError("--source-id must be in runtime config")
        query = {"sourceId": args.source_id, "needsRecheck": "true", "limit": "25"}
        if args.cursor:
            query["cursor"] = args.cursor
        print_result(request_json(origin, token, "GET", base + "?" + urllib.parse.urlencode(query)))
        return 0
    payload["dryRun"] = not args.apply
    response = request_json(origin, token, "POST", base + "/batch", payload)
    if not isinstance(response, dict) or not isinstance(response.get("results"), list):
        raise ValueError("Unexpected API response shape; no response body printed")
    safe_keys = {"index", "operationId", "outcome", "replayed", "listingId", "publicationStatus", "effectiveStatus", "publicUrl", "warnings", "errors"}
    results = [{key: value for key, value in item.items() if key in safe_keys} for item in response["results"]]
    print_result({"runId": response.get("runId"), "dryRun": response.get("dryRun"), "results": results})
    verification_errors = False
    if args.apply:
        for listing_id in dict.fromkeys(item.get("listingId") for item in results if item.get("listingId")):
            try:
                # Integration detail supports NEEDS_REVIEW; public404 would be expected there.
                detail = request_json(origin, token, "GET", base + "/" + urllib.parse.quote(listing_id, safe=""))
                print_result({"verified": detail.get("listing", {})})
            except ValueError as error:
                verification_errors = True
                print(f"Listing {listing_id}: verification pending ({error})", file=sys.stderr)
    return int(verification_errors or any(item.get("outcome") in {"rejected", "retryable_error"} for item in results))


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, KeyError, TypeError, OSError, json.JSONDecodeError) as error:
        # Never include Request repr, headers, bearer token or raw upstream response.
        print(f"Voi client: {error}", file=sys.stderr)
        sys.exit(1)
