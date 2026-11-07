# UI regression repair: icons, Settings, compact navigation

Status: Verified locally

## Report and reproduced evidence

The user reported incorrect icons, misaligned Settings and a disappearing mobile
navigation bar. Browser inspection reproduced switches below their labels at
320/390/768px and navigation leaving view after scrolling Home/Profile and in chat.
The code also used a sun-like hand-drawn glyph for Settings and a court as the
brand mark, while the native app's actual icon is the elephant asset.

The previous iframe-only pass was insufficient. It did not cover short viewports,
keyboard-driven height changes, or measurements of navigation after scrolling.

## Repair sequence

1. Reuse the actual native brand asset for the web logo/favicon. Replace common
   hand-drawn paths with Lucide icons, distinguish badminton navigation from court
   counts, and inspect every glyph at 20/24px in light/dark appearances.
2. Give Settings an independent grouped-list layout. Labels and controls occupy
   explicit grid columns. Align switch right edges and row centers, center the
   page on wide screens, and keep English labels and native selects inside cards.
3. Make compact navigation a dedicated row in the application viewport instead of
   a separately fixed element. Scroll only the content row. Follow visual viewport
   height/offset for focus and keyboard changes; retain compact navigation on
   touch landscape screens. A modal intentionally makes background nav inert.
4. Add executable Chromium + WebKit regression checks with direct browser
   viewports. Assert bounding boxes and route/current-tab behavior, take screenshots
   and then perform a separate human-style visual pass.

## Acceptance matrix

- Compact: 320×568, 375×667, 390×844, 430×932, 767×568.
- Touch landscape: 844×390. Tablet/desktop: 768×1024, 1024×768, 1440×900.
- Home, Profile, Settings, Inbox/thread, session detail, create, Groups and Map.
- Scroll start/end; route changes; filter modal open/close; focused chat input;
  reduced viewport height; return to full height; light/dark; Vietnamese/English.
- Four visible nav destinations on compact screens; sidebar on wider screens.
- Nav stays within viewport and outside main-content bounds; every tab remains
  clickable and Profile remains selected on Settings.
- Settings switch/control right edges align; toggles remain beside labels;
  centered page; no document/card horizontal overflow.
- No unexpected browser page errors. Preserve the existing API-backed flows.

## Honest limits

Headless WebKit is an engine-level check, not a physical iPhone. Resizing while an
input is focused tests the layout response; it does not emulate a native IME or
Safari's complete browser toolbar. Record those limits in the results.

## Results

- Final executable run: **28/28 passed**, Chromium and WebKit.
- Each engine covers six compact sizes across eight routes, five Settings sizes,
  tab navigation/modal focus, focused chat at reduced height, and logged-out login.
- The first run exposed a real WebKit focus-return issue; Dialog now restores its
  explicit filter trigger. It also exposed an ambiguous test selector, corrected
  to a combobox locator. A later WebKit test-driver wheel limitation was replaced
  with driver-assisted scrolling after checking the scrollable CSS contract.
- Direct measurements confirm nav stays within the visual viewport and outside
  the content area before/after scrolling; Settings control edges/centers align.
- Separate visual inspection confirmed the native elephant asset, distinct gear
  and sun icons, correct Settings breadcrumb/sidebar state and compact chat fit.
- The auth scroll check ensures viewport locking applies only to the signed-in
  application, retaining a scrollable sign-in form at 320×568 and 320×400.
- Unit tests: 12/12 passed. Type checking passed. Production build passed.

Screenshots: `apps/web/test-results/`; HTML report:
`apps/web/playwright-report/index.html`. Both are generated and ignored by Git.

Native mobile IME, device cutouts and browser chrome still need a physical device
check. WebKit is an engine-level test; it is not a claim of physical iPhone QA.
