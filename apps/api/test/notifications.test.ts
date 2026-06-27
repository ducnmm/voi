import { describe, expect, it } from "vitest";
import { getReminderTime } from "../src/services/notifications.js";

describe("notification service", () => {
  it("schedules reminders two hours before a future session", () => {
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const reminderTime = getReminderTime(startsAt);

    expect(reminderTime).not.toBeNull();
    expect(startsAt.getTime() - reminderTime!.getTime()).toBe(120 * 60 * 1000);
  });

  it("uses a custom reminder lead time", () => {
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const reminderTime = getReminderTime(startsAt, 60);

    expect(reminderTime).not.toBeNull();
    expect(startsAt.getTime() - reminderTime!.getTime()).toBe(60 * 60 * 1000);
  });

  it("does not schedule reminders in the past", () => {
    const startsAt = new Date(Date.now() + 30 * 60 * 1000);

    expect(getReminderTime(startsAt)).toBeNull();
  });
});
