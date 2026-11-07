import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaSource } from "../src/lib/media.ts";
test("API uploads use the web origin so another phone never requests its own localhost", () => {
  for (const origin of [
    "http://localhost:43187",
    "http://127.0.0.1:43187",
    "http://[::1]:43187",
  ])
    assert.equal(
      mediaSource(`${origin}/uploads/qa-photo.png`),
      "/api/media/qa-photo.png",
    );
});
test("remote images, QR data and unrelated URLs are left intact", () => {
  for (const value of [
    "https://api.example.com/uploads/photo.jpg",
    "data:image/png;base64,test",
    "/photos/venue.jpg",
    "http://localhost:43187/private",
    "http://localhost:43187/uploads/nested/file.jpg",
  ])
    assert.equal(mediaSource(value), value);
});
