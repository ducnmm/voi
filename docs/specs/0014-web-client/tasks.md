# Web client implementation and verification

- [x] Audit iOS behavior and visual tokens, replace marketplace mock entry.
- [x] Apple-style responsive shell, sheets, visual hierarchy, light/dark themes.
- [x] Real session feed, venue/skill/availability filters, saved/past/host views.
- [x] Groups, acceptance of invitations, QR/native sharing and onboarding.
- [x] Session create/edit/duplicate, photos/gallery, location pin and interactive map.
- [x] Four-week repeat with clear partial-failure recovery; calendar ICS export.
- [x] Cost breakdown, payment reference, host payment/check-in/lineup.
- [x] Match results, player reviews, people/following and profile.
- [x] Mobile inbox navigation/composer, older history, messages/read badges.
- [x] Alerts, notification preferences/lead time, language and account settings.
- [x] Native/web Apple audience + nonce validation, real Google login integration.
- [x] Same-origin API/media proxy, refresh including image uploads, logout.
- [x] Production build and type checking, focused unit tests, two-account API smoke.
- [x] Browser QA: 320/390/768/1024/1440, mobile forms/sheets/chat, dark/English.
- [x] Browser QA: weekly creation produced four sessions; map tiles/selection work.
- [ ] Google/Apple provider end-to-end: requires externally configured web clients.

Testing uses dedicated local QA accounts/groups. No production data changes,
hosting deployment, bank payment processing or Web Push provisioning.
