// Design-time seeder that populates the host's active group with a varied set
// of sessions (full / waitlist / open / past) so the iOS screens have enough
// data to design against. Talks to the running API over HTTP only — no DB
// credentials needed. Idempotent by title: sessions whose title already exists
// in the group are skipped.
//
// Usage (API must be running on :43187):
//   node apps/api/scripts/seed-design.mjs

const BASE = process.env.VOI_API_BASE ?? "http://localhost:43187/v1";

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  }
  return data;
}

const emailFor = (name) => `${name.toLowerCase()}@example.com`;

// Cache player logins so each demo user is created/fetched once.
const playerCache = new Map();
async function loginPlayer(name) {
  if (playerCache.has(name)) return playerCache.get(name);
  const res = await api("/auth/dev", {
    method: "POST",
    body: { email: emailFor(name), displayName: name }
  });
  const value = { token: res.token, userId: res.user.id };
  playerCache.set(name, value);
  return value;
}

const now = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function hoursFromNow(h, durationH = 2) {
  const start = new Date(now + h * HOUR);
  return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + durationH * HOUR).toISOString() };
}
function dayAt(days, hour, durationH = 2) {
  const start = new Date(now + days * DAY);
  start.setHours(hour, 0, 0, 0);
  return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + durationH * HOUR).toISOString() };
}

const CONFIGS = [
  {
    title: "Tonight Rally", venueName: "Ky Hoa Badminton", ...hoursFromNow(6),
    courtCount: 2, maxPlayers: 8, skillLevel: "INTERMEDIATE", feeTotalVnd: 240_000, shuttlecockCostVnd: 60_000,
    joined: ["An", "Binh", "Chi", "Duy", "Hai", "Linh", "Minh", "Tu"], waitlist: ["Quan", "Vy"],
    paid: ["An", "Chi", "Hai", "Minh"], seated: 8
  },
  {
    title: "Saturday Morning Doubles", venueName: "Phu Tho Sports Center", ...dayAt(1, 7),
    courtCount: 3, maxPlayers: 12, skillLevel: "OPEN", feeTotalVnd: 300_000, shuttlecockCostVnd: 90_000,
    joined: ["Khoa", "Nga", "Duy", "Linh", "Quan", "Vy"], paid: ["Khoa", "Nga"], seated: 2
  },
  {
    title: "Thursday Smash", venueName: "Hoa Lu Badminton", ...dayAt(2, 19),
    courtCount: 2, maxPlayers: 8, skillLevel: "ADVANCED", feeTotalVnd: 260_000, shuttlecockCostVnd: 70_000,
    joined: ["Chi", "Minh", "An", "Binh", "Hai"], seated: 4
  },
  {
    title: "Beginner Friendly Friday", venueName: "Ky Hoa Badminton", ...dayAt(4, 18),
    courtCount: 1, maxPlayers: 4, skillLevel: "BEGINNER", feeTotalVnd: 120_000, shuttlecockCostVnd: 30_000,
    joined: ["Vy", "Khoa"], seated: 2
  },
  {
    title: "Sunday League", venueName: "Phu Tho Sports Center", ...dayAt(6, 9, 3),
    courtCount: 4, maxPlayers: 16, skillLevel: "OPEN", feeTotalVnd: 480_000, shuttlecockCostVnd: 120_000,
    joined: ["An", "Binh", "Chi", "Duy", "Hai", "Linh", "Minh", "Tu", "Quan", "Vy"], waitlist: ["Khoa", "Nga"],
    paid: ["An", "Binh", "Chi", "Duy", "Hai"], seated: 8
  },
  {
    title: "Last Tuesday Social", venueName: "Ky Hoa Badminton", ...dayAt(-5, 19),
    courtCount: 2, maxPlayers: 8, skillLevel: "INTERMEDIATE", feeTotalVnd: 200_000, shuttlecockCostVnd: 50_000,
    joined: ["An", "Binh", "Chi", "Duy", "Hai", "Linh", "Minh", "Tu"],
    paid: ["An", "Binh", "Chi", "Duy", "Hai", "Linh", "Minh", "Tu"], seated: 8
  },
  {
    title: "Last Sunday Open", venueName: "Hoa Lu Badminton", ...dayAt(-9, 9),
    courtCount: 1, maxPlayers: 4, skillLevel: "OPEN", feeTotalVnd: 120_000, shuttlecockCostVnd: 30_000,
    joined: ["Vy", "Khoa", "Hai", "Tu"], paid: ["Vy", "Khoa", "Hai", "Tu"], seated: 4
  }
];

async function main() {
  const host = await api("/auth/dev", { method: "POST", body: { email: "host@example.com", displayName: "Host" } });
  const hostToken = host.token;

  const { groups } = await api("/groups", { token: hostToken });
  if (!groups.length) throw new Error("Host has no groups — open the app once to create one.");
  const group = groups[0];
  console.log(`Seeding into group: ${group.name} (${group.id})`);

  const detail = await api(`/groups/${group.id}`, { token: hostToken });
  const existingTitles = new Set(detail.group.sessions.map((s) => s.title).filter(Boolean));

  for (const cfg of CONFIGS) {
    if (existingTitles.has(cfg.title)) {
      console.log(`  = ${cfg.title} (already exists, skipped)`);
      continue;
    }

    const created = await api(`/groups/${group.id}/sessions`, {
      method: "POST",
      token: hostToken,
      body: {
        title: cfg.title,
        startsAt: cfg.startsAt,
        endsAt: cfg.endsAt,
        venueName: cfg.venueName,
        courtCount: cfg.courtCount,
        maxPlayers: cfg.maxPlayers,
        feeTotalVnd: cfg.feeTotalVnd,
        shuttlecockCostVnd: cfg.shuttlecockCostVnd,
        skillLevel: cfg.skillLevel,
        visibility: "PRIVATE_LINK"
      }
    });
    const sid = created.session.id;

    // RSVP joined first, then waitlist overflow (server resolves capacity).
    const userIdByName = new Map();
    for (const name of [...cfg.joined, ...(cfg.waitlist ?? [])]) {
      const player = await loginPlayer(name);
      userIdByName.set(name, player.userId);
      await api(`/sessions/${sid}/rsvp`, { method: "POST", token: player.token, body: { status: "JOINED" } });
    }

    // Re-read to map userId -> participantId and resolve court ids.
    const full = (await api(`/sessions/${sid}`)).session;
    const partByUserId = new Map(full.participants.map((p) => [p.userId, p]));

    // Payments (host action).
    for (const name of cfg.paid ?? []) {
      const part = partByUserId.get(userIdByName.get(name));
      if (part) {
        await api(`/sessions/${sid}/participants/${part.id}/payment`, {
          method: "PATCH",
          token: hostToken,
          body: { paymentStatus: "PAID" }
        });
      }
    }

    // Lineup (host action): seat the first N joined players, 4 per court.
    const courts = [...full.courts].sort((a, b) => a.sortOrder - b.sortOrder);
    const seatedParts = cfg.joined
      .map((name) => partByUserId.get(userIdByName.get(name)))
      .filter((p) => p && p.rsvpStatus === "JOINED")
      .slice(0, cfg.seated ?? 0);
    const assignments = seatedParts.map((p, i) => ({
      courtId: courts[Math.min(Math.floor(i / 4), courts.length - 1)].id,
      participantId: p.id,
      slotOrder: (i % 4) + 1
    }));
    if (assignments.length) {
      await api(`/sessions/${sid}/lineup`, { method: "PUT", token: hostToken, body: { assignments } });
    }

    console.log(
      `  + ${cfg.title} — ${cfg.joined.length}/${cfg.maxPlayers} joined` +
        `${cfg.waitlist?.length ? `, ${cfg.waitlist.length} waitlist` : ""}` +
        `${cfg.startsAt < new Date().toISOString() ? " (past)" : ""}`
    );
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
