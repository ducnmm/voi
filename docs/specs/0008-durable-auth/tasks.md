# Spec 0008 Tasks

- [x] `AuthProvider` enum, `AuthIdentity`, `RefreshToken` models + relations.
- [x] Migration `20260626130614_auth_identities_refresh_tokens`.
- [x] `GOOGLE_IOS_CLIENT_ID` / `APPLE_BUNDLE_ID` env (optional).
- [x] Google ID-token verifier (`google-auth-library`).
- [x] `auth-tokens` service: access (15m JWT), refresh (rotate/revoke, SHA-256).
- [x] Routes: `/auth/google`, `/auth/apple`, `/auth/refresh`, `/auth/logout`.
- [x] Tests: hashToken unit; Google create/repeat/invalid, refresh rotate +
      revoke, logout, unknown token, Apple create/repeat/link/invalid.
- [x] Sign in with Apple verification (`aud = com.voi.app`, Apple JWKS).
- [x] iOS: Google and Sign in with Apple; tokens in Keychain; refresh on 401.

## Follow-ups

- [ ] App ID capability "Sign in with Apple" must be on in the Apple Developer
      account (automatic signing turns it on at archive when the entitlement
      is present). The team is `6X8BZ996MA`.
