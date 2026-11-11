# DESIGN.md — portfolio redesign (B · 3D ko‘rgazma zali)

Visual source of truth: this file plus `.claude-state/DESIGN-SPEC-home.md` (geometry, wireframes, states). The approved concept mock is /home/ruzibekov/FL-Projects/frilans/portfolio/Portfolio/.claude-state/design-variants/b/ (operator 2026-11-11: «manashu style yoqdi, shunda professional tayyorlab ber»); where the mock and this file differ, this file wins (values below were re-measured). Site content stays from this branch (`content/*.json`); only presentation changes. Machine-readable token block: `.claude-state/tokens.css` (same values as below; the implementer copies it into `assets/` as the single token file).

## CONCEPT

A calm neutral black exhibition hall (palette A «Studio night»). The owner's real products stand in it as slabs (browser windows and phones, each carrying one real single-screen capture) on one deliberate arc that recedes from the front-left to the back-right at eye level. Scrolling walks the camera along the arc and a horizontal swipe, drag, wheel or arrow key steps it: drag or swipe left = next and → = next at every width, the next slab always waits on the right. Every step brings the next project to the front slot, and a placard names it. Everything around the hall is quiet: big wide display type, one lime action, solid surfaces, neutral shadows. The audience is a small-business owner in Uzbekistan/Russia: in five seconds they must see "this person builds real sites and apps" (the slabs) and "I can write to him in Telegram" (one button).

Brief: audience = small-business owners (uz/ru/en first, eight locales built: uz ru en ky kk tg uk be); primary task = open a Telegram chat about a project; hardest task = find a project like mine and judge it (filter → select → open case or live site); constraints = static build (`scripts/build-site.mjs`), no new runtime dependencies, CSS 3D on real DOM only, light + dark themes, ≥44 px targets, no gradients/glow.

## Tokens

Palette A «Studio night» (owner pick 2026-11-11, «manashu yoqdi»; record `.claude-state/DESIGN-OPTIONS.md` `## 2026-11-11 · site · palette`, source `.claude-state/palette-variants/a/tokens-final.css`, copied 1:1 into `assets/tokens.css`). A calm neutral black hall: the real project screenshots carry all the colour, one lime action. Measured with `palette.py --check FG BG` (WCAG ratio, full list `.claude-state/palette-variants/contrast.txt`). Neutrals are achromatic (no indigo, no warm tint); each theme has its own ladder (light is not an inversion of dark).

colour roles, dark (default, `:root`):

- canvas #0B0C0E · surface #1F2022 (1.20 vs canvas) · card #2D2E31 (1.20 vs surface) · field #393B3E (1.21 vs card)
- line #2A2B2E (hairline; 1.38 on canvas) · line-strong #666B76 (control borders; 3.66 on canvas · 3.05 on surface)
- ink #F2F3F5 (17.62 canvas · 14.69 surface · 12.23 card · 10.12 field)
- muted #A9ADB6 (8.70 canvas · 7.25 surface · 6.04 card · 5.00 field)
- faint #989DA7 (7.19 canvas · 5.99 surface · 4.99 card; never on field)
- accent #B5F23D lime fill (14.66 vs canvas), on-accent #0B0C0E (14.66) · accent-press #9CD922 (on-accent 11.52)
- accent-text #B5F23D (14.66 canvas · 12.22 surface · 10.17 card) · focus ring = accent-text
- ok #3DD9CF (status dot only, 9.34 on surface; the status word is ink)
- bezel #000000 (phone body; separated from canvas by a 1 px line ring)
- inverse #F2F3F5 / on-inverse #0B0C0E (SR mark, ink button)
- theme-color #0B0C0E

colour roles, light (`[data-theme='light']`):

- canvas #ECEDEF · surface #FFFFFF (1.17 above canvas) · card #D9DBDF (1.18 below canvas, sunken: selected rows, chip track, hover) · field #C4C7CD (1.22 below card, pressed)
- line #D0D3D8 · line-strong #6E737D (4.06 on canvas · 4.76 on surface)
- ink #0B0C0E (16.70 canvas · 19.57 surface · 14.12 card · 11.55 field)
- muted #4A4F58 (7.03 canvas · 8.23 surface · 5.94 card)
- faint #535862 (6.10 canvas · 7.14 surface · 5.15 card)
- accent #0B0C0E black fill (16.70 vs canvas), on-accent #B5F23D lime label (14.66) · accent-press #2A2C30 (lime 10.48)
- accent-text #0B0C0E (= ink; lime is never text on the light canvas, it only sits inside black fills)
- ok #08776F (5.41 on surface) · bezel #0B0C0E · inverse #0B0C0E / on-inverse #ECEDEF
- theme-color #ECEDEF
- scene in light: slabs keep their own screen colours; the depth-dimming layer (`.slab-dim`) is filled with the neutral light canvas.
  accent rule: accent fill only on the one primary action in view; accent-text only for the selected index number, focus ring, the arrow glyphs in the headline and the active minimap segment. Light theme placard number tile = black accent fill with the lime on-accent number (the only lime in light besides the primary button label). Selection elsewhere = tonal surface step + ink text (RD-25).
  theme-color meta: `<meta name="theme-color">` carries `data-dark`/`data-light` read from the `--theme-color` tokens at build time; the no-JS default is the dark value, `assets/theme-init.js` swaps it before first paint for a saved light theme, the theme toggle swaps it on change.

type (self-hosted woff2, `font-display: swap`; Google Fonts CSS links removed):

- display: Unbounded 500 (OFL), letter-spacing −0.035em, `font-variant-numeric: lining-nums tabular-nums` for numerals
  - h1 52/54 at ≥1200 px, `clamp(30px, 4.1vw, 52px)`, 390: 30/32; each `title[]` line is its own nowrap line (widest measured line «готовый продукт.» 559 px at 52 px → column 600 px)
  - h2 `clamp(26px, 3vw, 40px)` / 1.1, −0.03em; 390: 26/1.12
  - numerals (stats, placard number, process numbers): Unbounded 500, stats 30/1, placard 20/1, process 40/1
- ui: Onest 400/500/600 (OFL, already in `assets/fonts`)
  - h3 600 20/1.3 (390: 18/1.3) · lead 400 19/1.5 (390: 17/1.5) · body 400 17/1.55 (390: 16/1.55)
  - label 500 15/1.2 (nav links, buttons 16/1 600) · meta 400 14/1.4 · chip count 500 13/1 tabular-nums
- mono: JetBrains Mono 400 13/1.3 (OFL, latin subset only) — ONLY for ASCII identifiers: slab URL bar domains, stack strings (`item.stack`), the minimap step label. Never for words from locale files.
- ʻ/ʼ rule: Uzbek copy uses U+2018 ‘ (o‘, g‘); Unbounded and Onest contain U+2018, U+02BB, U+02BC; JetBrains Mono lacks U+02BB, so no Uzbek word ever goes into a mono node (build check: mono nodes match `^[\x20-\x7E·→/]+$`).
- Cyrillic rule: Unbounded lacks Қ Ғ Ң Ү Ұ Һ Ә Ө Ӣ Ӯ Ҷ (measured with fontTools), so `:lang(kk), :lang(ky), :lang(tg)` switch the display role to Onest 600 with −0.02em tracking for the whole page; ru/uk/be keep Unbounded (Ґ Є Ї Ў present). No per-glyph fallback inside a word.
- no ALL-CAPS tracked labels, no eyebrow line above section headings.
  spacing: 4 · 8 · 12 · 16 · 24 · 32 · 40 · 64 · 96 · 128 (page gutter 40 at ≥1024, 24 at 600–1023, 20 at <600; section gap 128 / 390: 88)
  radius: 6 (chip count) · 8 (inputs, small) · 14 (buttons, cards, browser slab) · 22 (panels: project index, contact block) · 32 (phone slab body) · 999 (chips, icon buttons, language trigger)
  concentric: browser slab outer 14, 1 px border → screen bottom corners 13, URL bar top corners 13; phone slab outer 32 − bezel 8 → screen 24 (390: 24 − 6 → 18); project index panel 22 − padding 8 → row 14; filter track 999 − 4 → chip 999.
  elevation (neutral shadows only, no coloured or light shadows, no glow):
- slab: dark `0 2px 4px rgba(0,0,0,.5), 0 36px 60px -18px rgba(0,0,0,.75)` · light `0 2px 4px rgba(0,0,0,.12), 0 32px 56px -18px rgba(0,0,0,.30)`
- pop (placard, language list, menu sheet): dark `0 12px 28px -10px rgba(0,0,0,.60)` · light `0 12px 28px -10px rgba(0,0,0,.24)`; scrim dark rgba(0,0,0,.55) · light rgba(0,0,0,.32). Every shadow is pure black rgba.
- no floor grid, no floor plane, no horizon: the scene is a pure colour field. Each slab carries its own contact shadow (`--contact-shadow`, pure black rgba(0,0,0,.42) dark / .16 light, never tinted), an ellipse 80 % of the slab width, 16 units tall, 4 units under the slab edge, softened by a 9-unit blur, moving with the slab and the camera, plus the existing neutral `--shadow-slab`.
- depth dimming of far slabs: a solid `::after` layer filled with canvas at opacity `--dim` (0 / .28 / .44), never blur, never gradient.
  icons: Lucide (already the site set in `scripts/site/icons.mjs`), stroke 1.75, 20 px in controls, 24 px in headline arrows (`i-arrow-right`, `i-arrow-down`, `i-arrow-up-right`, `i-arrow-left`, `i-chevron-down`, `i-contrast`, `i-menu`, `i-x`, `i-plus`, `i-mail`, `i-globe`, `i-smartphone`, `i-bot`, `i-workflow`, `i-layers`).
  logos: official marks only — Telegram (telegram.org brand paper plane), App Store (Apple "Download on the App Store" glyph), Google Play (Google Play brand triangle); already in the sprite as `l-telegram`, `l-appstore`, `l-googleplay`.

## Components

- nav: 1280 height 72, gutter 40; brand (SR mark 40×40 r10 ink on canvas-inverse + name Onest 500 15), 4 anchor links (label 15, padding 10/14, hover surface fill 160 ms), right group: language trigger, theme toggle, Telegram button. Transparent over the hero, solid canvas + 1 px line after 8 px scroll (240 ms colour). The nav Telegram button is quiet (surface fill, ink text, Telegram mark) while the hero primary is on screen and becomes the accent fill when the hero CTA leaves the viewport (IntersectionObserver), so exactly one accent fill is visible. 390: height 64, gutter 16: mark 44×44, language trigger, theme toggle, menu button (each 44×44, gap 8); name and links move to the menu sheet.
- language switch: existing `<details>` picker (8 locales). Trigger 44 high, min 64 wide, radius 999, surface fill + line border: flag 18 + code (Onest 500 14) + chevron; open list = pop panel radius 14, rows 44 high, flag + native name, current row = card fill + ink + `aria-current="page"`; Esc and outside click close; focus returns to trigger.
- theme toggle: 44×44 icon button, radius 999, surface + line, Lucide `i-contrast`, `aria-pressed` + label from `ui.controls.switchToLight/Dark`; theme change = colour-only transition 240 ms ease (hall "lights"), screens inside slabs unchanged.
- buttons: primary = accent fill, on-accent text, 52 high (390: 52, full width), radius 14, padding 0 24, gap 10, icon + label (Telegram mark 20 + verb). Secondary = surface fill, ink, 1 px line-strong, icon after label. Ink = ink fill, canvas label, no border, icon after label; used only for the showroom "open project" action so the showroom has one filled action while the accent stays on Telegram; hover = ink mixed 88% with canvas, pressed = 80% + scale .97. Quiet (icon + label, no border) for tertiary links. States: hover primary → accent-press, secondary → card fill (160 ms ease); focus-visible → 2 px accent-text ring, offset 3; pressed → scale .97 (100 ms in, 160 ms release, ease-out) and primary fill accent-press; disabled → field fill, faint text, no pointer, reason in adjacent text (only used by nothing on the static site; specified for completeness); external links show `i-arrow-up-right`.
- slab (browser): surface body, 1 px line border, radius 14, URL bar 28 high (card fill, domain in mono 12 faint, left-aligned, 12 inset), screen = one real 1280×800 capture, `object-fit: cover; object-position: top`. Slab (phone): bezel 8 (390: 6), outer radius 32, 1 px line ring, screen = one real 1080×2400 or 390×844 capture, radius 24. No laptop/phone composites, no device photos, no picture inside a picture.
- caption card (placard): surface, 1 px line, radius 14, pop shadow, padding 12 16 12 12, min-height 64: number tile 40×40 (dark: canvas fill, Unbounded 20 lime accent-text; light: black accent fill, lime on-accent number), title (Onest 600 16 ink), meta line (type word Onest 14 muted + stack mono 13 muted), status (dot ok + word ink, or official store marks). Always below the front slab with a 24 px gap, never over any slab; it is a link to the case page or the detail sheet.
- hero dock: the placard and the hero controls form one row group (`.hero-dock`, controls first in DOM): position counter «1 / 6» at ≥1024, «1 / 3» below (mono 12 faint, quieter than the 18 px accent catalogue number on the placard; a position, never a catalogue number), prev/next 44 icon buttons (`aria-disabled` at the ends: opacity .4, surface fill, no press), and the pips (one tab stop, roving tabindex, ←/→/Home/End). 1280+: dock at the right frame edge under the slab, controls directly under the placard; 390: controls directly above the placard, both above the fold. The placard tile shows the stable catalogue number (the project's place in the work index), the same on the work showroom, work list and detail sheet; the home showroom list is a curated subset and shows no numbers. Below 1024 the hero runs its own phone sequence (`heroPhoneSequence` in `scripts/site/home.mjs`: Best Tracker trio, Agentmama web slab as the right-edge peek, Stefa trio), so the first phone viewport leads with the real three-screen phone trio; the placard keeps the catalogue number, so it reads «12» there and «01» at ≥1024.
- swipe affordance: at 390 the next slab peeks 12–16 % of its width at the hall's right edge (opacity ≥ .3), above y 780 at 390×844; desktop rests with the front slab inside the 40 px gutter at 1024/1280/1440; during a drag slabs beyond ±2 positions are hidden.
- trio: a mobile app shows up to three distinct real states (centre = strongest, then flanks); a failed flank image drops that flank and the trio reflows to two; a failed centre swaps in the first surviving flank and reflows the same way; the typographic fallback slab shows only when every screen fails. Every phone capture is fitted to the 9:19.5 screen (padded with its own edge colour, never cropped) and every phone screen box is exactly 9:19.5, so `object-fit: cover` never clips. When the front of a showroom is any phone (one, two or three screens) the other projects' slabs fade out; the single phone sits centred at the trio-centre size. The detail sheet shows the same trio as the stage. In the hero, a slab leaving to the left fades within a quarter step and moves right and back (row s=−1 `[60, 10, -220, 28, 0]`), so it never crosses the copy column.
- filter chips with counts: track = card fill, radius 999, padding 4; chip 44 high, padding 0 16, label Onest 500 15 + count (Onest 500 13 tabular, faint); selected = surface fill (dark) / surface white (light) + ink label + ink count + `aria-pressed="true"`; hover = muted→ink label; focus ring; pressed scale .97; a chip whose count is 0 is not rendered.
- project list rows (showroom index): 48 high (390: 56), grid `40px 1fr auto`, number (Onest 500 14 tabular, faint), title (Onest 500 16 ink), type word (Onest 14 muted); hover = card fill 160 ms; focus-visible = 2 px accent-text ring inset 2; selected = canvas fill inside the surface panel (dark) / card fill (light) + title 600 + number in accent-text + `aria-current="true"`; pressed scale .99.
- prev/next: 48×48 icon buttons, radius 999, surface + line-strong, `i-arrow-left`/`i-arrow-right`, labels "Oldingi loyiha: <title>" / "Keyingi loyiha: <title>"; disabled never (the list wraps).
- section header: h2 left (Unbounded), optional count or one-line intro right-aligned (Onest 17 muted, max 36ch); no eyebrow, no caps label.
- FAQ item: `<details>` row min 64 high, question Onest 600 18 ink, `i-plus` 20 at right rotating 45° in 200 ms ease-out when open; answer Onest 17 muted, max 64ch; hairline line between items; focus ring on summary.
- contact block: surface panel radius 22, padding 64 (390: 24), h2 + intro + strap left, right column: primary Telegram button + mail link (`i-mail` + address, 44 high).
- footer: canvas, 1 px top line, brand mark + `ui.footer.line`, the four anchors, back-to-top quiet button (`i-arrow-up` + `backToTop`), © year; all targets 44.

motion: press scale .97 100 ms in / 160 ms release cubic-bezier(.23,1,.32,1); hover and colour 160 ms ease; theme colour swap 240 ms ease; UI spring (chips, rows, prev/next, slab swap) stiffness 210 damping 24 mass 1 (≈360 ms settle, interruptible, retargets from the rendered value); scene camera = critically damped follower on scroll step u, stiffness 170 damping 26 (≈600 ms settle, lag ≤120 ms), native scroll + `scroll-snap-type: y proximity` on hero steps, transform/opacity only, one rAF owner gated by IntersectionObserver + `document.visibilityState`; hero entry once: world translateZ −600 → 0 spring 170/26 (≈900 ms), placard rise 12 px + opacity 240 ms ease-out at 520 ms; placard swap = 12 px rise on the UI spring + opacity 200 ms as interruptible CSS transitions (all placards share one grid cell, so nothing reflows); showroom caption swap = 8 px rise on the UI spring + opacity 200 ms; leaving filter rows fade and rise 4 px in 160 ms before entering rows rise in; FAQ icon 200 ms; pointer parallax (fine pointer only) rotates the world ±1.4° y / ±0.9° x, lerp .12; swipe = direct manipulation of the same camera: scroll stays the single source of truth (desktop: scroll position of the hero track; mobile: scroll unit plus a persistent offset), a drag adds a transient offset so the camera follows the pointer 1:1 (desktop 355 units per project, drag right brings the next project forward because passed slabs leave to the right; mobile 276 units, drag left = next), on release the project is chosen from position + 0.15 s of release velocity, a flick faster than 0.9 project/s advances one, then desktop scrolls instantly to that project's snap anchor while the 170/26 spring carries the camera from where the finger left it, so scrolling afterwards never jumps; grabbing during a settle catches the camera at its rendered position; ends rubber-band (35 % of the overshoot, at most half a project), no wrap-around, so placard numbers always read 01 → last; horizontal trackpad wheel steps one project per gesture (320 ms silence unlocks; direction matches the drag), vertical wheel stays native; ←/→/Home/End on the focused hall; prev/next 48 px buttons beside the minimap; a polite live region reads the new front placard after user navigation; a drag over 8 px swallows the click, a mostly vertical gesture never moves the camera (`touch-action: pan-y`); prefers-reduced-motion: no dolly, no camera travel, swipe/keys/wheel step instantly, no parallax, no hover depth, every state jumps to its final value at once.

signature: the gallery arc — the owner's real single-screen captures standing as slabs on one receding arc in a neutral black hall, the camera walking the arc with scroll, and a placard under the front slab that names the project and links to it.

## Do

- Use only real captures listed in `.claude-state/DESIGN-SPEC-home.md` §Slab inventory; one capture per slab.
- Keep every slab inside the frame at rest (gutters per spec); far slabs recede by depth/scale and the solid dim layer.
- One accent fill per view; secondary actions are surface + border. The header Telegram button is the page's primary only while no in-page primary (`data-primary-cta`: hero or service CTA, the showroom «Loyiha sahifasi» links, the contact CTA) is in the viewport; then it drops to the quiet surface style. So it is lime from the first screen on work and case pages (they have no hero CTA) and turns lime on home and service pages once their hero CTA scrolls away. Checked per page type (home, work, case, service) at 1280 and 390, dark and light, by scrolling each page top to bottom: never two accent fills in one view (in light the inverse «Loyiha sahifasi» fill is also #0b0c0e, so near the contact block two dark fills meet; only the contact button carries the lime label).
- Every control ≥44×44; every state in the spec ships in the same change.
- Light theme gets its own frames at 390 and 1280 before showing.

## Don't

- No gradients, glow, neon, coloured or light shadows, blur-for-depth, glass.
- No warm cream/ivory, terracotta or editorial serif; no emoji; no marquee; no scroll-reveal fade-ins (content is in its final state when it scrolls in; only the hero camera is scroll-linked).
- No WebGL/Three.js, no Lenis (`assets/vendor/lenis.min.js` is present but unreferenced; it stays unreferenced), no scroll-jacking, no new dependencies.
- No composite images (laptop+phones, several phones) inside a slab; no text name or monogram for Telegram/App Store/Google Play.
- No code comments in the eventual code.
