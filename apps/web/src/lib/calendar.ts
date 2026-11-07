import type { SessionDetail } from "./api-types";
const escapeIcs = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const stamp = (value: string) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function sessionCalendar(
  session: Pick<
    SessionDetail,
    "id" | "title" | "venueName" | "startsAt" | "endsAt" | "status"
  >,
  url: string,
  now = new Date(),
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Voi//Badminton//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${session.id}@voi`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    `DTSTART:${stamp(session.startsAt)}`,
    `DTEND:${stamp(session.endsAt)}`,
    `SUMMARY:${escapeIcs(session.title || session.venueName)}`,
    `LOCATION:${escapeIcs(session.venueName)}`,
    `URL:${url}`,
    `STATUS:${session.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // RFC 5545 limits physical lines to 75 octets; do not split UTF-8 characters.
  const encoder = new TextEncoder();
  return (
    lines
      .map((line) => {
        let folded = "",
          count = 0;
        for (const char of line) {
          const bytes = encoder.encode(char).length;
          if (count + bytes > 74) {
            folded += "\r\n ";
            count = 1;
          }
          folded += char;
          count += bytes;
        }
        return folded;
      })
      .join("\r\n") + "\r\n"
  );
}
export function downloadCalendar(session: SessionDetail) {
  const url = URL.createObjectURL(
    new Blob([sessionCalendar(session, window.location.href)], {
      type: "text/calendar;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `voi-${session.id}.ics`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
