import { beforeEach, describe, expect, it, vi } from "vitest";
const { verify, config } = vi.hoisted(() => ({
  verify: vi.fn(),
  config: {
    GOOGLE_IOS_CLIENT_ID: "ios-client",
    GOOGLE_WEB_CLIENT_ID: "web-client",
  },
}));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = verify;
  },
}));
vi.mock("../src/config/env.js", () => ({ env: config }));
import { verifyGoogleIdToken } from "../src/services/identity/google.js";
describe("Google identity audiences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.GOOGLE_IOS_CLIENT_ID = "ios-client";
    config.GOOGLE_WEB_CLIENT_ID = "web-client";
  });
  it("checks both configured clients and returns the verified identity", async () => {
    verify.mockResolvedValue({
      getPayload: () => ({
        sub: "google-user",
        email: "player@example.com",
        email_verified: true,
        name: "Player",
      }),
    });
    await expect(verifyGoogleIdToken("signed-token")).resolves.toMatchObject({
      sub: "google-user",
      email: "player@example.com",
    });
    expect(verify).toHaveBeenCalledWith({
      idToken: "signed-token",
      audience: ["ios-client", "web-client"],
    });
  });
  it("keeps native login working when web is not configured", async () => {
    config.GOOGLE_WEB_CLIENT_ID = "";
    verify.mockResolvedValue({
      getPayload: () => ({
        sub: "user",
        email: "p@example.com",
        email_verified: true,
      }),
    });
    await verifyGoogleIdToken("native-token");
    expect(verify).toHaveBeenCalledWith({
      idToken: "native-token",
      audience: ["ios-client"],
    });
  });
  it("rejects unverified emails", async () => {
    verify.mockResolvedValue({
      getPayload: () => ({
        sub: "user",
        email: "p@example.com",
        email_verified: false,
      }),
    });
    await expect(verifyGoogleIdToken("token")).rejects.toThrow(
      "Invalid Google token payload",
    );
  });
  it("rejects login when no audience is configured", async () => {
    config.GOOGLE_IOS_CLIENT_ID = "";
    config.GOOGLE_WEB_CLIENT_ID = "";
    await expect(verifyGoogleIdToken("token")).rejects.toThrow(
      "not configured",
    );
    expect(verify).not.toHaveBeenCalled();
  });
});
