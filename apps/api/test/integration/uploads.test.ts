import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import {
  auth,
  buildTestApp,
  devLogin,
  prisma,
  resetDb
} from "../helpers.js";
import { UPLOADS_DIR } from "../../src/config/uploads.js";

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

let app: FastifyInstance;
const written: string[] = [];

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await Promise.all(written.map((file) => unlink(file).catch(() => undefined)));
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

function multipartPng(): { payload: Buffer; contentType: string } {
  const boundary = "----voi-test-boundary";
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="dot.png"\r\n` +
        `Content-Type: image/png\r\n\r\n`
    ),
    PNG,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  return {
    payload,
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

describe("POST /v1/uploads", () => {
  it("returns an absolute /uploads URL without a /v1 path", async () => {
    const { token } = await devLogin(app, "host@voi.test");
    const { payload, contentType } = multipartPng();
    const res = await app.inject({
      method: "POST",
      url: "/v1/uploads",
      headers: {
        ...auth(token),
        "content-type": contentType
      },
      payload
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { url: string };
    expect(body.url).toMatch(/^https?:\/\/[^/]+\/uploads\/[0-9a-f-]+\.png$/);
    expect(new URL(body.url).pathname.startsWith("/v1/")).toBe(false);

    const filename = path.basename(new URL(body.url).pathname);
    written.push(path.join(UPLOADS_DIR, filename));
  });

  it("rejects unauthenticated uploads", async () => {
    const { payload, contentType } = multipartPng();
    const res = await app.inject({
      method: "POST",
      url: "/v1/uploads",
      headers: { "content-type": contentType },
      payload
    });
    expect(res.statusCode).toBe(401);
  });
});
