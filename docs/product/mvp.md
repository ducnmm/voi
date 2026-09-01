# MVP Scope

The MVP should prove that Voi can replace chat-based coordination for small badminton groups.

## MVP Outcome

A host can create a badminton session, share it with a group, collect responses, manage a waitlist, organize courts, and track basic cost sharing.

## In Scope

- Native iOS app (SwiftUI) as the only client.
- Badminton as the only supported sport.
- Manual venue entry.
- Groups.
- Session creation.
- Invite link.
- RSVP states.
- Capacity and waitlist.
- Court lineup board.
- Basic cost split.
- Notification records with in-app surfacing; APNs delivery later through a worker.

## Out of Scope

- Venue booking marketplace.
- Payment processing.
- Public event discovery.
- Multi-sport support.
- Advanced matchmaking.
- Ranking and competitive ladders.
- Tournament brackets.
- Android app.
- Public web app as a product surface.
- Venue-owner tools or marketplace.
- In-app purchases or selling.

## Core MVP Flow

1. A host creates a group (roster of regulars).
2. The host creates a badminton session (one play).
3. The host shares an invite link (`voi://invites/{token}`).
4. Non-host players Join (Maybe / Can't are host tools).
5. Confirmed players fill available slots.
6. Extra players go to the waitlist.
7. The host reviews the lineup board.
8. The app calculates a simple per-player cost.
9. Players receive a reminder before the session.

## Success Metrics

- A host can create a session in under 30 seconds.
- A player can join from an invite in under 10 seconds.
- A host can understand the session status at a glance.
- A session page can replace the pinned message in a chat group.
- The host can see who has not paid without using a spreadsheet.
