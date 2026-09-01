import { describe, expect, it } from "vitest";
import { redactSensitiveUrl } from "../src/utils/log-redact.js";

describe("redactSensitiveUrl", () => {
  it("strips a query token from a WebSocket URL", () => {
    expect(
      redactSensitiveUrl("/v1/ws/groups/abc?token=header.payload.sig")
    ).toBe("/v1/ws/groups/abc?token=[Redacted]");
  });

  it("keeps other query params", () => {
    expect(
      redactSensitiveUrl("/v1/ws/sessions/x?token=secret&limit=2")
    ).toBe("/v1/ws/sessions/x?token=[Redacted]&limit=2");
  });

  it("leaves URLs without a token unchanged", () => {
    expect(redactSensitiveUrl("/v1/sessions?limit=2")).toBe("/v1/sessions?limit=2");
  });
});
