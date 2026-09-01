# Domain Model

This document defines the core nouns in Voi.

## User

A person who can host or join sessions.

Key fields:

- Display name.
- Avatar.
- Phone or email, depending on auth.
- Default skill level.

## Group

A recurring circle of players.

Examples:

- Tuesday Night Badminton.
- District 3 Intermediate Group.
- Office Badminton Club.

Key fields:

- Name.
- Description.
- Default venue.
- Default skill level.
- Members.
- Hosts.

## Session

A scheduled badminton gathering.

Key fields:

- Group.
- Host.
- Date and time.
- Venue.
- Court count.
- Capacity.
- Fee estimate.
- Shuttlecock cost.
- Skill level.
- Visibility.
- Status.

## Participant

A user's relationship to a session.

Possible RSVP states:

- Invited.
- Joined.
- Maybe.
- Declined.
- Waitlisted.
- Cancelled.

## Court

A playing surface inside a session.

MVP assumption:

- Each court has four default player slots.
- Courts are created from the session court count.
- Court labels can be simple: Court 1, Court 2, Court 3.

## Lineup Slot

A participant assigned to a court position.

MVP assumption:

- Position names are optional.
- Manual drag or tap-to-move can come after the first version.

## Payment Record

A lightweight record of whether a participant has paid for the session.

MVP assumption:

- Payment is tracked manually by the host.
- No real money movement happens in the app.

## Invite

A shareable way to access a group or session.

MVP assumption:

- Session invite links are enough.
- Invite permissions can be basic: anyone with the link can view and request to join.

## Push Device

A mobile device registered for push notification delivery, used by the later iOS channel.

MVP assumption:

- Device tokens are stored before APNs delivery is implemented; the iOS app surfaces notifications in-app.
- A device can be disabled when the user signs out or revokes notifications.

## Notification Preference

User-level controls for notification behavior.

Key fields:

- Reminders enabled.
- Status change notifications enabled.
- Waitlist notifications enabled.
- Reminder lead time.
