import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAppleKeyCache,
  verifyAppleIdentityToken
} from "../src/services/identity/apple.js";

const AUDIENCE = "com.voi.app";

function jwkFor(publicKey: KeyObject, kid: string) {
  const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  return { ...jwk, kid, alg: "RS256", use: "sig" };
}

function token(
  privateKey: KeyObject,
  kid: string,
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: "RS256", kid }
): string {
  const headerPart = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signed = `${headerPart}.${payloadPart}`;
  const signature = sign("RSA-SHA256", Buffer.from(signed), privateKey).toString(
    "base64url"
  );
  return `${signed}.${signature}`;
}

function identityPayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://appleid.apple.com",
    aud: AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + 600,
    sub: "apple-sub-1",
    email: "ada@privaterelay.appleid.com",
    email_verified: true,
    ...overrides
  };
}

function stubKeys(keys: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ keys })
    }))
  );
}

afterEach(() => {
  clearAppleKeyCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("verifyAppleIdentityToken", () => {
  it("accepts a token signed by Apple's published key", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    stubKeys([jwkFor(publicKey, "key-1")]);

    const identity = await verifyAppleIdentityToken(
      token(privateKey, "key-1", identityPayload()),
      AUDIENCE
    );

    expect(identity).toEqual({
      sub: "apple-sub-1",
      email: "ada@privaterelay.appleid.com"
    });
  });

  it("accepts email_verified as the string true and omits a missing email", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    stubKeys([jwkFor(publicKey, "key-1")]);

    const withString = await verifyAppleIdentityToken(
      token(
        privateKey,
        "key-1",
        identityPayload({ email_verified: "true", email: "a@voi.test" })
      ),
      AUDIENCE
    );
    expect(withString.email).toBe("a@voi.test");

    clearAppleKeyCache();
    const withoutEmail = await verifyAppleIdentityToken(
      token(
        privateKey,
        "key-1",
        identityPayload({ email: undefined, email_verified: undefined })
      ),
      AUDIENCE
    );
    expect(withoutEmail).toEqual({ sub: "apple-sub-1" });
  });

  it("refetches keys when the token kid is not in the cache", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: [jwkFor(other, "old")] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: [jwkFor(publicKey, "new")] })
      });
    vi.stubGlobal("fetch", fetchMock);

    const identity = await verifyAppleIdentityToken(
      token(privateKey, "new", identityPayload()),
      AUDIENCE
    );

    expect(identity.sub).toBe("apple-sub-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a bad signature, audience, issuer, expiry, and unverified email", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    stubKeys([jwkFor(publicKey, "key-1")]);
    const valid = token(privateKey, "key-1", identityPayload());
    const [header, body] = valid.split(".");
    const tampered = `${header}.${body}.${"a".repeat(32)}`;

    await expect(verifyAppleIdentityToken(tampered, AUDIENCE)).rejects.toThrow(
      /signature/
    );
    await expect(
      verifyAppleIdentityToken(
        token(privateKey, "key-1", identityPayload({ aud: "com.other.app" })),
        AUDIENCE
      )
    ).rejects.toThrow(/audience/);
    await expect(
      verifyAppleIdentityToken(
        token(privateKey, "key-1", identityPayload({ iss: "https://evil.example" })),
        AUDIENCE
      )
    ).rejects.toThrow(/issuer/);
    await expect(
      verifyAppleIdentityToken(
        token(
          privateKey,
          "key-1",
          identityPayload({ exp: Math.floor(Date.now() / 1000) - 120 })
        ),
        AUDIENCE
      )
    ).rejects.toThrow(/expired/);
    await expect(
      verifyAppleIdentityToken(
        token(privateKey, "key-1", identityPayload({ email_verified: false })),
        AUDIENCE
      )
    ).rejects.toThrow(/verified/);
    await expect(
      verifyAppleIdentityToken("not-a-jwt", AUDIENCE)
    ).rejects.toThrow(/Invalid Apple token/);
    await expect(
      verifyAppleIdentityToken(
        token(privateKey, "key-1", identityPayload(), { alg: "none", kid: "key-1" }),
        AUDIENCE
      )
    ).rejects.toThrow(/header/);
  });
});
