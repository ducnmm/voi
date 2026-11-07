// Run against local development services only. Creates isolated QA accounts/group.
import assert from "node:assert/strict";
const base = process.env.VOI_SMOKE_URL ?? "http://127.0.0.1:43188/api/v1";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Smoke tests require a local development API.");
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
const run = Date.now();
const host = await call("/auth/dev", null, "POST", {
  email: `web-smoke-host-${run}@example.com`,
  displayName: "Web Smoke Host",
});
const guest = await call("/auth/dev", null, "POST", {
  email: `web-smoke-guest-${run}@example.com`,
  displayName: "Web Smoke Guest",
});
const h = host.accessToken;
const g = guest.accessToken;
const { group } = await call("/groups", h, "POST", {
  name: `Web Smoke ${run}`,
});
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
const mediaResponse = await fetch(
  `${new URL(base).origin}/api/media/${new URL(upload.url).pathname.split("/").pop()}`,
);
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
console.log(
  "PASS: proxy, images, accounts, group/invite, RSVP/waitlist/promotion, payment, check-in, lineup, edit, results, reviews, group/session chat, saved feed, follow, notifications, preferences, refresh/logout.",
);
console.log(`QA group: ${group.id}; QA session: ${session.id}`);
