#!/usr/bin/env node
// Small API client for testing Muse payloads without exposing the key in argv.
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
const { values } = parseArgs({ options: {
  "api-origin": { type: "string" }, "key-file": { type: "string" },
  file: { type: "string" }, "dry-run": { type: "boolean", default: false },
} });
try {
  if (!values["api-origin"] || !values["key-file"] || !values.file) {
    throw new Error("Required: --api-origin https://api.example.com --key-file /secure/key --file payload.json [--dry-run]");
  }
  const url = new URL(values["api-origin"]);
  if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("Use HTTPS, or HTTP localhost for development");
  }
  const token = (await readFile(values["key-file"], "utf8")).trim();
  if (!/^voi_int\.[\w-]+\.[\w-]+$/.test(token)) throw new Error("Invalid key file");
  const payload = JSON.parse(await readFile(values.file, "utf8"));
  if (values["dry-run"]) payload.dryRun = true;
  const response = await fetch(`${url.origin}/v1/integrations/community-listings/batch`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  process.stdout.write(`${JSON.stringify({ status: response.status, ...body }, null, 2)}\n`);
  if (!response.ok || body.results?.some((item) => ["rejected", "retryable_error"].includes(item.outcome))) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
