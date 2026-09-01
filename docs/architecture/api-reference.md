# API Reference Draft

The Voi API is a JSON HTTP API. Authentication uses a bearer token during development.

Base URL for local development:

```text
http://localhost:43187/v1
```

## Auth

### POST /auth/dev

Development login. Creates or updates a user and returns a token.

Request:

```json
{
  "email": "host@example.com",
  "displayName": "Host"
}
```

Response:

```json
{
  "token": "jwt",
  "user": {
    "id": "user_id",
    "email": "host@example.com",
    "displayName": "Host"
  }
}
```

### GET /me

Returns the authenticated user.

## Groups

### GET /groups

Returns groups where the authenticated user is a member.

### POST /groups

Creates a group and assigns the authenticated user as host.

Request:

```json
{
  "name": "Tuesday Night Badminton",
  "defaultVenueName": "Ky Hoa Badminton",
  "defaultSkillLevel": "INTERMEDIATE"
}
```

### GET /groups/:groupId

Returns group detail, members, and sessions.

## Sessions

### POST /groups/:groupId/sessions

Creates a session. Only group hosts can create sessions.

Request:

```json
{
  "title": "Tuesday Night Badminton",
  "startsAt": "2026-06-02T12:00:00.000Z",
  "endsAt": "2026-06-02T14:00:00.000Z",
  "venueName": "Ky Hoa Badminton",
  "courtCount": 2,
  "feeTotalVnd": 240000,
  "shuttlecockCostVnd": 60000,
  "skillLevel": "INTERMEDIATE",
  "visibility": "PRIVATE_LINK"
}
```

Rules:

- `maxPlayers` defaults to `courtCount * 4`.
- Currency is VND.
- Monetary values are integer VND amounts.

### POST /groups/:groupId/invites

Creates a group invite link. Only group hosts can create group invites.

### GET /sessions/:sessionId

Returns public session detail.

### PATCH /sessions/:sessionId

Updates host-editable session fields. Changing start time reschedules pending reminder records. Changing time or venue creates session change notification records.

### POST /sessions/:sessionId/cancel

Cancels a session, cancels pending reminder records, and creates cancellation notification records.

### POST /sessions/:sessionId/rsvp

Updates the authenticated user's RSVP.

Request:

```json
{
  "status": "JOINED"
}
```

Rules:

- Available capacity produces `JOINED`.
- Full capacity produces `WAITLISTED`.
- Cancelling a joined player promotes the first waitlisted player.

### PUT /sessions/:sessionId/lineup

Replaces the host-managed court lineup.

Request:

```json
{
  "assignments": [
    {
      "courtId": "court_id",
      "participantId": "participant_id",
      "slotOrder": 1
    }
  ]
}
```

### PATCH /sessions/:sessionId/participants/:participantId/payment

Marks a participant as paid or unpaid.

Request:

```json
{
  "paymentStatus": "PAID"
}
```

## Invites

### GET /invites/:token

Resolves a session or group invite.

### POST /invites/:token/accept

Accepts a group or session invite and adds the authenticated user to the group.

## Notifications

### GET /notifications

Returns the authenticated user's notification records.

Notification records are persisted and surfaced in the iOS app. APNs delivery is added through a background worker.

### GET /notification-preferences

Returns notification preferences for the authenticated user.

### PUT /notification-preferences

Updates notification preferences.

Request:

```json
{
  "remindersEnabled": true,
  "statusChangesEnabled": true,
  "waitlistEnabled": true,
  "reminderLeadMinutes": 120
}
```

## Devices

### GET /devices

Returns active push devices for the authenticated user.

### POST /devices

Registers or re-enables a push device token.

Request:

```json
{
  "platform": "IOS",
  "deviceToken": "apns-device-token",
  "appVersion": "0.1.0"
}
```

### DELETE /devices/:deviceId

Disables a push device for the authenticated user.
