# Spec 0006: Notifications

## Status

Draft

## Problem

Sports sessions depend on attendance reliability. Players need timely reminders and hosts need confidence that changes are seen.

## Goal

Players receive useful notifications for session reminders and important status changes.

## Users

- Host
- Player

## In Scope

- Session reminder before start time.
- Waitlist promotion notification.
- Session cancellation notification.
- Session time or venue change notification.
- Basic notification preferences.

## Out of Scope

- SMS.
- Zalo.
- Email campaigns.
- Marketing notifications.
- Complex notification rules.

## Primary Flow

1. Player joins a session.
2. App schedules a reminder.
3. Player receives a reminder before the session starts.
4. If their waitlist status changes, they receive a notification.

## Edge Cases

- User denies push notification permission.
- Session time changes after reminder is scheduled.
- Player cancels attendance.
- Session is cancelled.
- Notification delivery fails.

## Data Model

- notifications
- session_participants
- sessions

## Acceptance Criteria

- Given a joined player with notifications enabled, when a reminder time arrives, then the player receives a session reminder.
- Given a waitlisted player is promoted, when promotion happens, then the player receives a notification.
- Given a session is cancelled, when cancellation is saved, then joined and waitlisted players are notified.
- Given a player cancels attendance, when reminders are processed, then that player does not receive future reminders for the session.

## Open Questions

- What should the default reminder time be: 2 hours before, 1 hour before, or both?
- Should the first MVP use local notifications before server push is wired up?

