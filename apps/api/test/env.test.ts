import { describe, expect, it } from "vitest";
import {
  corsOriginsFor,
  missingProductionSecrets,
  originFromUrl,
  resolveListenPort,
  resolvePublicApiOrigin
} from "../src/config/env.js";

describe("resolveListenPort", () => {
  it("prefers API_PORT over PORT", () => {
    expect(resolveListenPort({ apiPort: 43187, port: 8080 })).toBe(43187);
  });

  it("uses PORT when API_PORT is unset (Railway)", () => {
    expect(resolveListenPort({ port: 8080 })).toBe(8080);
  });

  it("defaults to 43187", () => {
    expect(resolveListenPort({})).toBe(43187);
  });
});

describe("originFromUrl", () => {
  it("keeps scheme and host and drops a /v1 path", () => {
    expect(originFromUrl("https://api.example.com/v1")).toBe(
      "https://api.example.com"
    );
  });

  it("strips trailing slashes", () => {
    expect(originFromUrl("https://api.example.com/")).toBe(
      "https://api.example.com"
    );
  });

  it("adds https when the value is a bare host", () => {
    expect(originFromUrl("voi-api.up.railway.app")).toBe(
      "https://voi-api.up.railway.app"
    );
  });
});

describe("resolvePublicApiOrigin", () => {
  it("prefers PUBLIC_API_URL", () => {
    expect(
      resolvePublicApiOrigin({
        publicApiUrl: "https://api.example.com/v1",
        railwayPublicDomain: "ignored.up.railway.app",
        protocol: "http",
        host: "localhost:43187"
      })
    ).toBe("https://api.example.com");
  });

  it("uses Railway's public domain as https when PUBLIC_API_URL is unset", () => {
    expect(
      resolvePublicApiOrigin({
        railwayPublicDomain: "voi-production.up.railway.app",
        protocol: "http",
        host: "localhost:8080"
      })
    ).toBe("https://voi-production.up.railway.app");
  });

  it("falls back to the incoming request origin", () => {
    expect(
      resolvePublicApiOrigin({
        protocol: "https",
        host: "voi-production.up.railway.app"
      })
    ).toBe("https://voi-production.up.railway.app");
  });
});

describe("corsOriginsFor", () => {
  it("reflects any origin in development when CORS_ORIGINS is *", () => {
    expect(corsOriginsFor("development", "*")).toBe(true);
  });

  it("reflects nothing in production when CORS_ORIGINS is *", () => {
    expect(corsOriginsFor("production", "*")).toEqual([]);
  });

  it("parses an allow-list", () => {
    expect(corsOriginsFor("production", "https://a.test, https://b.test")).toEqual(
      ["https://a.test", "https://b.test"]
    );
  });
});

describe("missingProductionSecrets", () => {
  it("is empty outside production", () => {
    expect(
      missingProductionSecrets({
        nodeEnv: "development",
        jwtSecret: undefined,
        googleIosClientId: undefined
      })
    ).toEqual([]);
  });

  it("requires JWT_SECRET and GOOGLE_IOS_CLIENT_ID in production", () => {
    expect(
      missingProductionSecrets({
        nodeEnv: "production",
        jwtSecret: "   ",
        googleIosClientId: ""
      })
    ).toEqual(["JWT_SECRET", "GOOGLE_IOS_CLIENT_ID"]);
  });

  it("is empty when both production secrets are set", () => {
    expect(
      missingProductionSecrets({
        nodeEnv: "production",
        jwtSecret: "a-very-long-secret",
        googleIosClientId: "123.apps.googleusercontent.com"
      })
    ).toEqual([]);
  });
});
