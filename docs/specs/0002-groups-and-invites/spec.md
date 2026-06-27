# Spec 0002: Groups and Invites

## Status

Draft

## Problem

Badminton sessions usually happen with familiar groups. Hosts need a fast way to reuse the same player circle and share new sessions.

## Goal

A host can create a group, create sessions under that group, and invite players through a shareable link.

## Users

- Host
- Player

## In Scope

- Create a group.
- View group sessions.
- Add basic group details.
- Create a session invite link.
- Allow players with a link to view the session.
- Allow players to join the group after joining a session.

## Out of Scope

- Public group discovery.
- Group search.
- Complex permissions.
- Admin approval workflows.
- Organization-level accounts.

## Primary Flow

1. Host creates a group.
2. Host creates a session in that group.
3. Host shares the session invite link.
4. Player opens the invite.
5. Player views the session and can RSVP.

## Edge Cases

- Invite link is expired or invalid.
- Player opens a link for a cancelled session.
- Player is not signed in.
- Player is already a group member.

## Data Model

- groups
- group_members
- sessions
- invites

## Acceptance Criteria

- Given a new host, when they create a group, then the host becomes a group host.
- Given a valid session invite link, when a player opens it, then the player can view session details.
- Given an unauthenticated player, when they try to RSVP, then the app prompts lightweight sign-in.
- Given a cancelled session, when a player opens its invite, then the page clearly shows that the session is cancelled.

## Open Questions

- Should group invite links and session invite links be separate in MVP?
- Should a player be able to RSVP with only a display name before creating a full account?

