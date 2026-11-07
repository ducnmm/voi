// Run inside the API container. Creates isolated fixtures, never prints credentials,
// and deletes only IDs created by this invocation, even when an assertion fails.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR } from "../dist/config/uploads.js";
import { buildApp } from "../dist/app.js";
import { prisma } from "../dist/db/prisma.js";
import { issueAccessToken, issueRefreshToken } from "../dist/services/auth-tokens.js";

const origin = process.env.VOI_PRODUCTION_SMOKE_ORIGIN;
assert.ok(origin, "VOI_PRODUCTION_SMOKE_ORIGIN is required");
const base = `${origin.replace(/\/$/, "")}/api/v1`;
const run = randomUUID();
const ids = [];
let groupId;
let sessionId;
let uploadedPath;
let liveSocket;
const app = await buildApp();
await app.ready();
async function account(role) {
  const user = await prisma.user.create({ data: {
    email: `release-qa-${role}-${run}@example.com`, displayName: `Release QA ${role}`,
  } });
  ids.push(user.id);
  return { user, accessToken: issueAccessToken(app, user.id), refreshToken: await issueRefreshToken(user.id) };
}
async function call(path, token, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(payload)}`);
  return payload;
}
try {
const host = await account("host");
const guest = await account("guest");
const h = host.accessToken;
const g = guest.accessToken;
const { group } = await call("/groups", h, "POST", {
  name: `Web Smoke ${run}`,
});
groupId = group.id;
const uploadForm = new FormData();
uploadForm.append(
  "file",
  new Blob(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jTtUAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    { type: "image/png" },
  ),
  "qa.png",
);
const uploadResponse = await fetch(`${base}/uploads`, {
  method: "POST",
  headers: { authorization: `Bearer ${h}` },
  body: uploadForm,
});
assert.ok(uploadResponse.ok, "Image upload should succeed");
const upload = await uploadResponse.json();
uploadedPath = new URL(upload.url).pathname;
const mediaResponse = await fetch(`${new URL(base).origin}/api/media/${uploadedPath.split("/").pop()}`);
assert.ok(
  mediaResponse.ok,
  "Local images should be available through the web origin on other devices",
);
assert.match(mediaResponse.headers.get("content-type"), /^image\//);
const { session } = await call(`/groups/${group.id}/sessions`, h, "POST", {
  title: "Kèo kiểm thử web",
  venueName: "Sân QA",
  startsAt: new Date(Date.now() + 86400000).toISOString(),
  endsAt: new Date(Date.now() + 93600000).toISOString(),
  courtCount: 1,
  maxPlayers: 1,
  skillLevel: "INTERMEDIATE",
  visibility: "PRIVATE_LINK",
  costTrackingEnabled: true,
  feePerPlayerVnd: 80000,
});
sessionId = session.id;
assert.equal(session.summary.joinedPlayerCount, 1);
assert.equal(session.summary.perPlayerCostVnd, 80000);
const invite = session.inviteUrlToken;
assert.ok(invite);
await call(`/invites/${invite}`, null);
await call(`/invites/${invite}/accept`, g, "POST");
const waited = await call(`/sessions/${session.id}/rsvp`, g, "POST", {
  status: "JOINED",
});
assert.equal(
  waited.session.participants.find((p) => p.userId === guest.user.id)
    .rsvpStatus,
  "WAITLISTED",
);
const promoted = await call(`/sessions/${session.id}/rsvp`, h, "POST", {
  status: "CANCELLED",
});
const participant = promoted.session.participants.find(
  (p) => p.userId === guest.user.id,
);
assert.equal(participant.rsvpStatus, "JOINED");
const paid = await call(
  `/sessions/${session.id}/participants/${participant.id}/payment`,
  h,
  "PATCH",
  { paymentStatus: "PAID" },
);
assert.equal(
  paid.session.participants.find((p) => p.id === participant.id).paymentStatus,
  "PAID",
);
await call(
  `/sessions/${session.id}/participants/${participant.id}/checkin`,
  h,
  "POST",
);
const lineup = await call(`/sessions/${session.id}/lineup`, h, "PUT", {
  assignments: [
    {
      courtId: session.courts[0].id,
      participantId: participant.id,
      slotOrder: 1,
    },
  ],
});
assert.equal(lineup.session.courts[0].lineupSlots[0].user.id, guest.user.id);
await call(`/sessions/${session.id}`, h, "PATCH", {
  title: "Kèo kiểm thử đã sửa",
});
assert.equal(
  (await call(`/sessions/${session.id}`, g)).session.title,
  "Kèo kiểm thử đã sửa",
);
await call(`/sessions/${session.id}/results`, g, "POST", {
  label: "Trận QA",
  scoreA: 21,
  scoreB: 18,
});
assert.equal(
  (await call(`/sessions/${session.id}/results`, g)).results[0].scoreA,
  21,
);
await call(`/sessions/${session.id}/reviews`, g, "POST", {
  subjectId: host.user.id,
  rating: 5,
  comment: "QA",
});
assert.equal(
  (await call(`/users/${host.user.id}/reviews`, g)).reviews[0].rating,
  5,
);
await call(`/groups/${group.id}/messages`, g, "POST", {
  body: "Hẹn gặp trên sân!",
});
assert.equal(
  (await call(`/groups/${group.id}/messages`, h)).messages[0].body,
  "Hẹn gặp trên sân!",
);
await call(`/sessions/${session.id}/messages`, g, "POST", {
  body: "Tin nhắn trong kèo",
});
assert.equal(
  (await call(`/sessions/${session.id}/messages`, h)).messages[0].body,
  "Tin nhắn trong kèo",
);
// Exercise the same upgrade/proxy path as the browser, with server-side room authorization.
const socketURL = new URL(`${base}/ws/groups/${groupId}`);
socketURL.protocol = socketURL.protocol === "https:" ? "wss:" : "ws:";
socketURL.searchParams.set("token", h);
liveSocket = new WebSocket(socketURL);
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("WebSocket room authorization timed out")), 15000);
  liveSocket.addEventListener("message", (event) => {
    if (JSON.parse(String(event.data)).type === "ready") { clearTimeout(timeout); resolve(); }
  });
  liveSocket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("WebSocket proxy connection failed")); }, { once: true });
});
const liveBody = `Release live check ${run}`;
const received = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("WebSocket broadcast timed out")), 15000);
  liveSocket.addEventListener("message", (event) => {
    const payload = JSON.parse(String(event.data));
    if (payload.type === "message" && payload.message?.body === liveBody) { clearTimeout(timeout); resolve(); }
  });
});
await call(`/groups/${groupId}/messages`, g, "POST", { body: liveBody });
await received;
liveSocket.close();
liveSocket = null;

await call(`/sessions/${session.id}/save`, g, "PUT");
assert.ok(
  (await call("/sessions?savedOnly=true", g)).sessions.some(
    (s) => s.id === session.id,
  ),
);
await call(`/users/${host.user.id}/follow`, g, "PUT");
assert.ok(
  (await call("/me/following", g)).users.some((u) => u.id === host.user.id),
);
await call("/notifications/read-all", g, "POST");
assert.equal((await call("/me/badges", g)).alertsUnread, 0);
const prefs = await call("/notification-preferences", g, "PUT", {
  remindersEnabled: false,
});
assert.equal(prefs.preference.remindersEnabled, false);
const refreshed = await call("/auth/refresh", null, "POST", {
  refreshToken: guest.refreshToken,
});
assert.equal((await call("/me", refreshed.accessToken)).user.id, guest.user.id);
await call("/auth/logout", null, "POST", {
  refreshToken: refreshed.refreshToken,
});

// PRIVATE_LINK intentionally permits link discovery; GROUP_ONLY must reject outsiders.
await call(`/sessions/${sessionId}`, h, "PATCH", { visibility: "GROUP_ONLY" });
const stranger = await account("stranger");
const denied = await fetch(`${base}/sessions/${sessionId}`, { headers: { authorization: `Bearer ${stranger.accessToken}` } });
assert.ok([403, 404].includes(denied.status), "Unrelated account must not access a group-only session");
const dev = await fetch(`${base}/auth/dev`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "must-not-create@example.com" }) });
assert.equal(dev.status, 404, "Production dev login must stay disabled");
console.log("PASS: production proxy, upload/media, invites, waitlist/promotion, host payment/check-in/lineup, edit/results/reviews, group/session chat and live WebSocket, save/follow, alerts/preferences, refresh/logout, private-session isolation, dev-login disabled.");
} finally {
  liveSocket?.close();
  if (groupId) await prisma.group.deleteMany({ where: { id: groupId, createdByUserId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids }, email: { endsWith: `${run}@example.com` } } });
  if (uploadedPath && /^\/uploads\/[a-zA-Z0-9._-]+$/.test(uploadedPath)) {
    await unlink(path.join(UPLOADS_DIR, path.basename(uploadedPath))).catch(() => {});
  }
  await app.close();
  await prisma.$disconnect();
  console.log("QA cleanup complete: only this run's users/group/session/upload removed.");
}
