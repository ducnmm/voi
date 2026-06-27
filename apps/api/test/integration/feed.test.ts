import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  auth,
  buildTestApp,
  createGroup,
  createSession,
  devLogin,
  prisma,
  resetDb,
  rsvp
} from "../helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

async function feed(token: string, query = ""): Promise<any> {
  const res = await app.inject({
    method: "GET",
    url: `/v1/sessions${query}`,
    headers: auth(token)
  });
  return res.json();
}

describe("GET /v1/sessions feed", () => {
  it("returns only the requester's group sessions", async () => {
    const host = await devLogin(app, "feed_host@voi.test");
    const gid = await createGroup(app, host.token);
    await createSession(app, host.token, gid, { title: "Mine" });
    const outsider = await devLogin(app, "feed_out@voi.test");

    expect((await feed(host.token)).sessions.map((s: any) => s.title)).toEqual([
      "Mine"
    ]);
    expect((await feed(outsider.token)).sessions).toEqual([]);
  });

  it("upcoming excludes past and cancelled sessions", async () => {
    const host = await devLogin(app, "feed_h2@voi.test");
    const gid = await createGroup(app, host.token);
    await createSession(app, host.token, gid, { title: "Future" });
    await createSession(app, host.token, gid, {
      title: "Past",
      startsAt: "2026-06-01T12:00:00.000Z",
      endsAt: "2026-06-01T14:00:00.000Z"
    });
    const cancel = await createSession(app, host.token, gid, {
      title: "Cancelled"
    });
    await app.inject({
      method: "POST",
      url: `/v1/sessions/${cancel.id}/cancel`,
      headers: auth(host.token)
    });

    const up = (await feed(host.token, "?scope=upcoming")).sessions.map(
      (s: any) => s.title
    );
    expect(up).toContain("Future");
    expect(up).not.toContain("Past");
    expect(up).not.toContain("Cancelled");

    const past = (await feed(host.token, "?scope=past")).sessions.map(
      (s: any) => s.title
    );
    expect(past).toContain("Past");
  });

  it("surfaces fixed price, cost tracking and geo; fixed price ignores joins", async () => {
    const host = await devLogin(app, "feed_fix@voi.test");
    const gid = await createGroup(app, host.token);
    await createSession(app, host.token, gid, {
      title: "Fixed",
      costTrackingEnabled: true,
      feePerPlayerVnd: 80000,
      venueLat: 10.77,
      venueLng: 106.7
    });

    const s = (await feed(host.token)).sessions[0];
    expect(s.costTrackingEnabled).toBe(true);
    expect(s.feePerPlayerVnd).toBe(80000);
    expect(s.venueLat).toBeCloseTo(10.77);
    expect(s.summary.perPlayerCostVnd).toBe(80000);
  });

  it("auto split is null with no joined players", async () => {
    const host = await devLogin(app, "feed_split@voi.test");
    const gid = await createGroup(app, host.token);
    await createSession(app, host.token, gid, {
      feeTotalVnd: 240000,
      shuttlecockCostVnd: 60000
    });
    expect((await feed(host.token)).sessions[0].summary.perPlayerCostVnd).toBeNull();
  });

  it("sorts by price (cheapest first, null last)", async () => {
    const host = await devLogin(app, "feed_price@voi.test");
    const gid = await createGroup(app, host.token);
    await createSession(app, host.token, gid, { title: "Cheap", feePerPlayerVnd: 50000 });
    await createSession(app, host.token, gid, { title: "Pricey", feePerPlayerVnd: 90000 });
    await createSession(app, host.token, gid, { title: "Free" });

    const titles = (await feed(host.token, "?sort=price")).sessions.map(
      (s: any) => s.title
    );
    expect(titles[0]).toBe("Cheap");
    expect(titles[titles.length - 1]).toBe("Free");
  });

  it("sorts by spots (most open first)", async () => {
    const host = await devLogin(app, "feed_spots@voi.test");
    const gid = await createGroup(app, host.token);
    await createSession(app, host.token, gid, { title: "Few", courtCount: 1 }); // 4
    await createSession(app, host.token, gid, { title: "Many", courtCount: 4 }); // 16
    const titles = (await feed(host.token, "?sort=spots")).sessions.map(
      (s: any) => s.title
    );
    expect(titles[0]).toBe("Many");
  });

  it("filters by skill and venue (case-insensitive)", async () => {
    const host = await devLogin(app, "feed_filter@voi.test");
    const gid = await createGroup(app, host.token);
    await createSession(app, host.token, gid, {
      title: "Adv",
      skillLevel: "ADVANCED",
      venueName: "Hoa Lu"
    });
    await createSession(app, host.token, gid, {
      title: "Beg",
      skillLevel: "BEGINNER",
      venueName: "Phu Tho"
    });

    expect(
      (await feed(host.token, "?skill=ADVANCED")).sessions.map((s: any) => s.title)
    ).toEqual(["Adv"]);
    expect(
      (await feed(host.token, "?venue=hoa")).sessions.map((s: any) => s.title)
    ).toEqual(["Adv"]);
  });

  it("availableOnly excludes a full session", async () => {
    const host = await devLogin(app, "feed_av@voi.test");
    const gid = await createGroup(app, host.token);
    const full = await createSession(app, host.token, gid, {
      title: "Full",
      courtCount: 1,
      maxPlayers: 1
    });
    await rsvp(app, host.token, full.id, "JOINED");
    await createSession(app, host.token, gid, { title: "Open", courtCount: 1 });

    const titles = (await feed(host.token, "?availableOnly=true")).sessions.map(
      (s: any) => s.title
    );
    expect(titles).toContain("Open");
    expect(titles).not.toContain("Full");
  });

  it("keyset paginates without overlap", async () => {
    const host = await devLogin(app, "feed_page@voi.test");
    const gid = await createGroup(app, host.token);
    for (const day of ["2026-07-10", "2026-07-11", "2026-07-12"]) {
      await createSession(app, host.token, gid, {
        title: day,
        startsAt: `${day}T12:00:00.000Z`,
        endsAt: `${day}T14:00:00.000Z`
      });
    }

    const page1 = await feed(host.token, "?limit=2");
    expect(page1.sessions.length).toBe(2);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await feed(
      host.token,
      `?limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`
    );
    const ids1 = page1.sessions.map((s: any) => s.id);
    const ids2 = page2.sessions.map((s: any) => s.id);
    expect(ids2.length).toBe(1);
    expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
  });

  it("requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/sessions" });
    expect(res.statusCode).toBe(401);
  });
});
