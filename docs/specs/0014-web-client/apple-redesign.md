# Web visual refresh — Apple reference

Reference: https://getdesign.md/apple/design-md (design brief supplied by user).

## Scope

Apply the user's supplied Apple design language to the existing API-backed web
client. Keep the application's desktop split navigation and compact mobile tabs,
with a slim black global bar, centered page introductions, a single blue action
color, system typography, quiet surfaces, and flat utility cards.

The application remains a scheduling tool: forms, inbox and map retain their
functional layouts instead of becoming marketing product tiles.

## Changes

- Center constrained forms and profile pages inside the workspace, independent
  of the desktop sidebar. Shared content width and balanced gutters apply to all
  routes, including wide desktop screens.
- Blue actions (#0066cc light, #2997ff dark), blue focus, white/parchment and
  charcoal surfaces; remove green/orange brand accents and decorative gradients.
- System text at 17px with 1.47 leading, 600-weight headings, responsive display
  sizes, centered headings and descriptions.
- Capsule CTAs, outlined secondary actions, 18px utility cards, 8px compact
  controls, hairline borders, and no card/button shadows.
- Centered profile identity tile, refined Settings rows, session cards, filters,
  chat, map markers, authentication and shared empty states.
- Preserve the mobile viewport and safe-area navigation behavior.

## Validation

Production build and type checking passed. All 12 web unit tests passed.
Browser regression checks cover Chromium and WebKit, including desktop centering
on nine routes at 1024/1440/1880px and the existing mobile navigation, Settings,
modal-focus, reduced-height chat and sign-in scrolling matrix.

Final development-server run: **34/34 passed** across Chromium and WebKit,
including the development-only sign-in form. Production layout checks also passed
16/16 per engine (development-only sign-in excluded). Screenshot inspection
confirmed balanced desktop profile margins, compact home controls, and aligned
Settings rows in light/dark appearances. Headless WebKit
and viewport resizing do not establish physical iPhone keyboard/browser-chrome
behavior. This refresh is local; no hosting or identity-provider setup is changed.

## Compact copy and icon follow-up

Remove decorative page eyebrows/subtitles, topbar slogan and sidebar sign-off.
Retain session time, group identity/description, field instructions and recovery
messages. Compact heading spacing follows the actual content.

Replace Lucide and hand-drawn navigation icons with 31 self-contained Cupertino
vector glyphs, including available filled selection variants. Source:
https://github.com/flutter/packages/tree/main/third_party/packages/cupertino_icons
and the Flutter Cupertino codepoint definitions. MIT license is retained at
`apps/web/public/licenses/cupertino-icons.txt`. These are Cupertino Icons, not
Apple SF Symbols; no Apple SF Symbols assets are bundled in the web client.

Follow-up checks: 12/12 focused Chromium/WebKit tests passed (320/390px,
Settings controls, tabs, modal focus, reduced-height chat). Visual inspection of
all 31 icon pairs and home/profile/messages/settings confirmed complete glyphs,
centered content, removed decorative copy, and retained functional descriptions.

## Typography refinement

Browser CDP inspection on macOS confirmed the original system stack already
rendered SF NS/San Francisco. The problem was hierarchy: page titles reached
50.4px at 1440px while metadata scattered across 11–15px declarations.

Move typography into `apps/web/src/app/typography.css`, remove competing type
rules from layout CSS and replace inline size literals with shared tokens.
Use 34px desktop/28px compact page titles, 21px sections, 19px session titles,
17px body/inputs/actions, 15px callouts, 13px metadata and 12px captions. Keep
10px only for compact tab labels and badge counts. Body is regular 400, headings
and emphasis 600; tracking scales with text size and optical sizing stays auto.

Reference: https://developer.apple.com/videos/play/wwdc2020/10175/
The type scale is a web-app adaptation, not a claim of native Dynamic Type.

Typography validation: full updated layout suite **34/34 passed** across Chromium
and WebKit. Desktop profile and 390px Settings screenshot review confirmed the
new hierarchy, readable Vietnamese accents, and aligned labels/controls. System
font verification on macOS uses browser CDP platform-font data, not only the CSS
font-family string.

## Custom select menus

Replace every visible native select with a shared Radix Select component. Keep
the existing controlled string/number values and callbacks; native option
children supply labels only. Empty-string choices are encoded internally so
filters and bench assignment still work.

Settings shows an inline value/chevron. Forms use a bordered trigger. Both open
a styled, collision-aware listbox with a selected checkmark, typeahead, keyboard
navigation, Escape/outside dismissal and focus restoration. Menus in native
modal dialogs portal into that dialog so they remain interactive and accessible.
Popup content is independent of cards with overflow clipping.

Reference: https://www.radix-ui.com/primitives/docs/components/select

## Theme and empty-chat follow-ups

Make the global bar use the active glass/ink/surface tokens, including its avatar,
instead of fixed black/white values. Light appearance now has a light frosted
header and dark text; dark appearance retains dark surfaces and light text.

Use flex alignment for empty states. In an empty conversation, center the chat
icon and prompt together in the available history area; preserve sent/received
bubble alignment. Regression coverage includes both appearance modes and empty
chat geometry at 390px and 1440px, without creating or deleting messages.

Final combined follow-up validation: **38/38** regression/dropdown checks plus
**6/6** header and empty-chat checks passed across Chromium/WebKit. Tests cover
keyboard selection, focus return, outside dismissal, persistence, dialogs,
light/dark headers and icon/prompt centers. Popup sizing no longer depends on
observer-produced size variables, removing the observed WebKit ResizeObserver
feedback warning without filtering browser errors. Screenshot inspection
confirmed the light header and the centered chat empty state.


## Desktop navigation simplification

Remove the desktop global bar: sidebar navigation already exposes alerts, profile
and page destinations. Content starts directly in the workspace, with no empty
header row. Retain the compact header on phones/touch landscape alongside the
existing bottom navigation. Move desktop sticky detail panels to a 24px top inset.

Desktop navigation validation: 8/8 focused Chromium/WebKit checks passed,
including centered content across nine routes at 1024/1440/1880px and compact-only
header behavior in both themes.
