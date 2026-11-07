import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { request, ApiError, uploadImage } from "../src/lib/api-client.ts";
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
let expired = 0;
beforeEach(() => {
  storage.clear();
  expired = 0;
  globalThis.localStorage = localStorage;
  globalThis.window = {
    localStorage,
    dispatchEvent: (event) => {
      if (event.type === "voi:expired") expired++;
    },
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  delete globalThis.localStorage;
});
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
test("concurrent expired requests rotate the refresh token once and retry with the new token", async () => {
  storage.set("voi.token", "old");
  storage.set("voi.refresh", "refresh-old");
  let refreshes = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return json({ accessToken: "new", refreshToken: "refresh-new" });
    }
    return options.headers.authorization === "Bearer new"
      ? json({ ok: true })
      : json({ error: { message: "Expired" } }, 401);
  };
  const result = await Promise.all([
    request("/me", { token: "old" }),
    request("/groups", { token: "old" }),
  ]);
  assert.deepEqual(result, [{ ok: true }, { ok: true }]);
  assert.equal(refreshes, 1);
  assert.equal(storage.get("voi.refresh"), "refresh-new");
});
test("invalid refresh expires the local session without retry loops", async () => {
  storage.set("voi.refresh", "bad");
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return json({ error: { code: "UNAUTHORIZED", message: "Expired" } }, 401);
  };
  await assert.rejects(
    request("/me", { token: "old" }),
    (err) => err instanceof ApiError && err.status === 401,
  );
  assert.equal(calls, 2);
  assert.equal(expired, 1);
});
test("server validation errors retain their message and code", async () => {
  globalThis.fetch = async () =>
    json({ error: { code: "BAD_REQUEST", message: "Kèo đã kết thúc" } }, 400);
  await assert.rejects(
    request("/sessions/x/rsvp", { method: "POST", body: { status: "JOINED" } }),
    (err) => err.code === "BAD_REQUEST" && err.message === "Kèo đã kết thúc",
  );
});
test("non-JSON proxy failures become readable errors", async () => {
  globalThis.fetch = async () => new Response("Bad gateway", { status: 502 });
  await assert.rejects(
    request("/me"),
    (err) => err.code === "invalid_response" && err.status === 502,
  );
});
test("public requests do not attach the locally stored token", async () => {
  storage.set("voi.token", "private");
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.authorization, undefined);
    return json({ ok: true });
  };
  await request("/invites/public");
});
test("a late old-token response reuses an already rotated access token", async () => {
  storage.set("voi.token", "old");
  storage.set("voi.refresh", "refresh-old");
  let refreshes = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      return json({ accessToken: "new", refreshToken: "refresh-new" });
    }
    if (options.headers.authorization === "Bearer new")
      return json({ ok: true });
    if (url.endsWith("/groups"))
      await new Promise((resolve) => setTimeout(resolve, 25));
    return json({ error: { message: "Expired" } }, 401);
  };
  await Promise.all([
    request("/me", { token: "old" }),
    request("/groups", { token: "old" }),
  ]);
  assert.equal(refreshes, 1);
});

test("photo uploads refresh an expired access token and resend the multipart body", async () => {
  storage.set("voi.token", "old");
  storage.set("voi.refresh", "refresh-old");
  let uploads = 0;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/auth/refresh"))
      return json({ accessToken: "new", refreshToken: "refresh-new" });
    uploads++;
    assert.ok(options.body instanceof FormData);
    assert.equal(options.headers["content-type"], undefined);
    return options.headers.authorization === "Bearer new"
      ? json({ url: "https://api.example.com/uploads/image.png" })
      : json({ error: { message: "Expired" } }, 401);
  };
  const url = await uploadImage(
    "old",
    new File(["png-fixture"], "qa.png", { type: "image/png" }),
  );
  assert.equal(url, "https://api.example.com/uploads/image.png");
  assert.equal(uploads, 2);
});
