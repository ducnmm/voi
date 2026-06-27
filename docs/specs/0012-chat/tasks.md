# Spec 0012 Tasks

- [x] `ChatMessage` model (session/author relations, `(session_id, created_at)` index).
- [x] Migration `20260626125308_chat_messages`.
- [x] `SendMessageSchema` in `packages/shared`.
- [x] `chat-presenter` (message DTO + keyset cursor encode/decode).
- [x] `chat-hub` (in-memory room registry + broadcast).
- [x] `@fastify/websocket` registered.
- [x] Routes: `GET`/`POST /sessions/:id/messages`, `GET /ws/sessions/:id`.
- [x] Access control (host / member / participant); WS token via query.
- [x] Tests: hub unit (3), REST (3: authZ, validation, pagination),
      WebSocket (3: broadcast, 4001 bad token, 4003 non-member). 57/57 green.

## Follow-ups

- Redis pub/sub to fan out across multiple API instances (Spec 0013 era).
- iOS: point ChatView at the history endpoint + WebSocket (Phase A).
