import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionCalendar } from "../src/lib/calendar.ts";
const session = {
  id: "calendar-qa",
  title: "Kèo tối; sân A, B\\C\nGặp bạn",
  venueName: "Kỳ Hòa",
  startsAt: "2026-10-28T12:00:00.000Z",
  endsAt: "2026-10-28T14:00:00.000Z",
  status: "OPEN",
};
test("calendar exports UTC times and escapes user text without injecting properties", () => {
  const calendar = sessionCalendar(
    session,
    "https://voi.example/sessions/calendar-qa",
    new Date("2026-10-27T01:00:00Z"),
  );
  assert.match(calendar, /DTSTART:20261028T120000Z\r\n/);
  assert.match(calendar, /DTEND:20261028T140000Z\r\n/);
  assert.ok(calendar.includes("SUMMARY:Kèo tối\\; sân A\\, B\\\\C\\nGặp bạn"));
  assert.match(calendar, /STATUS:CONFIRMED/);
  assert.equal(calendar.split("BEGIN:VEVENT").length, 2);
  const malicious = sessionCalendar(
    { ...session, title: "Hello\rATTENDEE:bad" },
    "https://voi.example",
  );
  assert.ok(malicious.includes("Hello\\nATTENDEE:bad"));
});
test("long Vietnamese event titles fold at valid UTF-8 boundaries and unfold losslessly", () => {
  const title = "Cầu lông cùng những người bạn ở thành phố Hồ Chí Minh ".repeat(
    6,
  );
  const calendar = sessionCalendar(
    { ...session, title },
    "https://voi.example",
  );
  for (const line of calendar.split("\r\n"))
    assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.ok(calendar.replace(/\r\n /g, "").includes(`SUMMARY:${title}`));
  assert.ok(!calendar.includes("�"));
});
test("cancelled sessions retain the stable event UID and cancelled status", () => {
  const calendar = sessionCalendar(
    { ...session, status: "CANCELLED" },
    "https://voi.example",
  );
  assert.match(calendar, /UID:calendar-qa@voi/);
  assert.match(calendar, /STATUS:CANCELLED/);
});
