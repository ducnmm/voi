# Web client aligned with iOS

Status: Verified

## Intent
Players and hosts can use the existing Voi account and data from phones, tablets
and computers. Use Apple's visual hierarchy, split views and sheets while keeping
Voi's green identity. Preserve native iOS behavior where the browser permits it.

## Implemented scope
- Four destinations: sessions, inbox, alerts, profile. Wide split-view navigation;
  compact floating tabs, reserved space and visual-viewport keyboard handling.
- Real feed, venue/skill/availability filters, saved/past views and host management.
- Group/session invites, QR, native share/copy fallback and three-slide onboarding.
- Session create/edit/duplicate, four weekly sessions, photos/gallery, location pin,
  interactive map, calendar export, fixed/split costs and payment-reference QR.
- RSVP/waitlist, host payment/check-in/lineup, results and attendee reviews.
- Group/session chat, older history retained during live refresh, unread badges.
- People, follows, reviews, profile, preferences, Vietnamese/English and themes.
- Real Google and Apple credential exchanges, token refresh/logout and native/web
  audience verification. Apple web uses OAuth state and a verified nonce.
- Same-origin API and image proxies so LAN clients do not call their own localhost.

## Verification
- Web type checking and production build.
- Focused request/refresh/upload, calendar escaping/folding, media-origin and
  native/web identity tests.
- Real local API smoke with host/guest: invitation, waitlist/promotion, payment,
  check-in, lineup, edit, results/review, chat, saved/follow, alerts and preferences.
- Browser QA at CSS widths 320, 390, 768, 1024, 1440: grid transitions, no visible
  horizontal overflow, safe tab area, mobile composer/back, sheets/forms, map
  markers/tiles, language/theme reload persistence and exactly four weekly sessions.

## External setup and boundaries
Google/Apple provider end-to-end needs registered web clients and domains; no
provider configuration or deployment is performed. No bank processing or invented
venue coordinates. Calendar uses ICS; sharing follows available browser APIs.
Native APNs is platform-specific; background Web Push/PWA installation is outside
this implementation. Map tile provider and attribution are configurable.
