# Spec 0008: Durable Auth (Google, Apple, refresh tokens)

## Status

Draft — Google shipped; Apple pending a paid Apple Developer account.

## Problem

Development login is a placeholder. The app needs real sign-in and a token
lifecycle that survives app restarts and supports sign-out.

## Goal

Users sign in with Google (and later Apple); the backend issues a short-lived
access token plus a rotating, revocable refresh token.

## Users

- Host
- Player

## In Scope

- `POST /v1/auth/google` — verify the iOS Google ID token (audience =
  `GOOGLE_IOS_CLIENT_ID`), upsert the user + `AuthIdentity`, return
  `{ accessToken, refreshToken, user }`.
- `POST /v1/auth/refresh` — rotate: revoke the presented refresh token, issue a
  new access + refresh pair.
- `POST /v1/auth/logout` — revoke a refresh token.
- `POST /v1/auth/apple` — endpoint exists but returns 501 until the Apple
  Developer account + verification are configured.
- Access token TTL 15m; refresh token 30 days, stored SHA-256-hashed.

## Out of Scope (blocked on a paid Apple Developer account)

- Sign in with Apple verification (needs the App ID capability + bundle audience).
- Email/password (not planned).

## Primary Flow

1. iOS gets a Google ID token via the Google Sign-In SDK.
2. iOS calls `/auth/google`; backend verifies and returns the token pair.
3. iOS stores both in the Keychain; uses the access token as `Bearer`.
4. On 401, iOS calls `/auth/refresh`; on sign-out, `/auth/logout`.

## Edge Cases

- Invalid/expired Google token → 401.
- Reusing a rotated/revoked refresh token → 401.
- Repeat Google login → same user, no duplicate identity.

## Data Model

- auth_identities (provider, provider_sub) unique — links external IdP to a user.
- refresh_tokens (token_hash unique, expires_at, revoked_at).

## Acceptance Criteria

- Given a valid Google token, when posted, then a user + identity exist and a
  token pair is returned, and the access token authorizes `/me`.
- Given a refresh token, when rotated, then a new pair is returned and the old
  refresh token no longer works.
- Given logout, then the refresh token is revoked.

## Open Questions

- Refresh-token reuse detection (revoke the whole chain on replay)?
- Access-token TTL tuning (15m default).
