# Spec 0012: Session Chat (Realtime)

## Status

Draft

## Problem

A session needs a group chat so players can coordinate ("running late", "who has
shuttles"). It is mock-only in iOS today.

## Goal

People in a session can read message history and exchange messages in realtime.

## Users

- Host
- Player

## In Scope

- `GET /v1/sessions/:id/messages?limit=&before=` — keyset history, oldest→newest,
  `before` cursor loads older pages.
- `POST /v1/sessions/:id/messages` — send (also broadcasts to live subscribers).
- `GET /v1/ws/sessions/:id?token=` — WebSocket stream; receive `{type:"ready"}`
  on join, then `{type:"message", message}` per new message; send `{body}` to post.
- Access = host, group member, or session participant.

## Out of Scope

- Read receipts, typing indicators, presence.
- Editing/deleting messages, reactions, attachments.
- Cross-instance fan-out (needs Redis pub/sub — see architecture notes).

## Primary Flow

1. A player opens the session chat → `GET …/messages` for history + opens the
   WebSocket.
2. They send a message; everyone connected receives it instantly; offline members
   read it later from history.

## Edge Cases

- Non-member tries REST send/read → 403; WebSocket closes with code 4003.
- Invalid/missing token on the WebSocket → closes with 4001.
- Empty or >2000-char body → 400 (REST) / ignored (WebSocket).
- Sending right after connect → the `ready` frame tells the client the room is
  joined, avoiding a race with async authorization.

## Data Model

- chat_messages (id, session_id, author_id, body, created_at), indexed on
  (session_id, created_at) for keyset pagination.

## Acceptance Criteria

- Given a participant sends a message, when another connected member is in the
  room, then they receive it over the WebSocket.
- Given 5 messages, when paged with `limit=2`, then pages return the latest two
  first and `before` walks backward without overlap.
- Given a stranger, when they read or send, then the request is rejected (403 /
  ws 4003).

## Open Questions

- Should messages be editable/deletable by the author?
- Do we add presence/typing indicators later?
