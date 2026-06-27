# Spec 0008 Tasks

- [x] `AuthProvider` enum, `AuthIdentity`, `RefreshToken` models + relations.
- [x] Migration `20260626130614_auth_identities_refresh_tokens`.
- [x] `GOOGLE_IOS_CLIENT_ID` / `APPLE_BUNDLE_ID` env (optional).
- [x] Google ID-token verifier (`google-auth-library`).
- [x] `auth-tokens` service: access (15m JWT), refresh (rotate/revoke, SHA-256).
- [x] Routes: `/auth/google`, `/auth/refresh`, `/auth/logout`; `/auth/apple` 501 stub.
- [x] Tests: hashToken unit; Google create/repeat/invalid, refresh rotate +
      revoke, logout, unknown token, apple 501 (mocked verifier). 67/67 green.

## Blocked / follow-ups

- [ ] Sign in with Apple verification — needs a **paid Apple Developer account**
      (App ID "Sign in with Apple" capability; verify token `aud = com.voi.app`).
- [ ] iOS: Google Sign-In SDK → call `/auth/google`; store tokens in Keychain;
      gate the app on auth; refresh on 401 (Phase A / Spec wiring).
