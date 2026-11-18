"""Offline compatibility tests for the Muse handoff; never calls a live API."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("voi_submit", Path(__file__).with_name("submit.py"))
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.config = {"sources": [{"sourceId": "test-source", "externalGroupId": "12345"}], "areas": [{"code": "test-area"}]}
        self.payload = {"schemaVersion": 1, "runId": "test-run", "dryRun": True, "items": [{
            "operationId": "test-op", "sourceId": "test-source", "sourcePostId": "67890",
            "sourceUrl": "https://www.facebook.com/groups/12345/posts/67890/", "action": "UPSERT",
            "listing": {"areaCode": "test-area", "scheduleKind": "SINGLE"}, "evidence": {},
        }]}

    def test_original_v1_stays_valid(self):
        client.check_payload(self.payload, self.config)

    def test_v2_allows_optional_proposals(self):
        self.payload["schemaVersion"] = 2
        self.payload["items"][0]["listing"].update(venueId=None, venueMapsUrl=None, skillProposal=None)
        self.payload["items"][0]["evidence"]["skill"] = "Nam TBY đến TB"
        client.check_payload(self.payload, self.config)

    def test_v1_cannot_silently_gain_v2_fields(self):
        for field in ["venueId", "venueMapsUrl", "skillProposal"]:
            payload = copy.deepcopy(self.payload)
            payload["items"][0]["listing"][field] = None
            with self.assertRaisesRegex(ValueError, "schemaVersion=2"):
                client.check_payload(payload, self.config)
        self.payload["items"][0]["evidence"]["skill"] = "TB"
        with self.assertRaisesRegex(ValueError, "schemaVersion=2"):
            client.check_payload(self.payload, self.config)

    def test_bool_and_unsupported_versions_are_rejected(self):
        for version in [True, 3, "2", None]:
            self.payload["schemaVersion"] = version
            with self.assertRaises(ValueError):
                client.check_payload(self.payload, self.config)

    def test_wrong_source_identity_remains_rejected(self):
        self.payload["schemaVersion"] = 2
        self.payload["items"][0]["sourceUrl"] = "https://www.facebook.com/groups/55555/posts/67890/"
        with self.assertRaises(ValueError):
            client.check_payload(self.payload, self.config)

    def test_duplicate_operations_remain_rejected(self):
        self.payload["items"].append(copy.deepcopy(self.payload["items"][0]))
        with self.assertRaises(ValueError):
            client.check_payload(self.payload, self.config)

    def test_invalid_proposal_shape_is_rejected_offline(self):
        self.payload["schemaVersion"] = 2
        self.payload["items"][0]["listing"]["skillProposal"] = "guess"
        with self.assertRaises(ValueError):
            client.check_payload(self.payload, self.config)

    def test_v2_skill_text_requires_source_quote_even_without_proposal(self):
        self.payload["schemaVersion"] = 2
        self.payload["items"][0]["listing"].update(skillText="Nam TB", skillProposal=None)
        for quote in [None, "", "  "]:
            self.payload["items"][0]["evidence"]["skill"] = quote
            with self.assertRaisesRegex(ValueError, "evidence.skill"):
                client.check_payload(self.payload, self.config)
        self.payload["items"][0]["evidence"]["skill"] = "Nam TB"
        client.check_payload(self.payload, self.config)


if __name__ == "__main__":
    unittest.main()
