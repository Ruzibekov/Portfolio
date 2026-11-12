# Portfolio — design tokens

## Positioning

Shavkat Ruzibekov — product engineer portfolio. Tone: quiet engineering, not a
template landing. No decorative orbs, no marquee, no neon glow: hierarchy,
typography and real project screenshots carry the page.

## Palette

| Token   | Dark      | Light     | Role        |
| ------- | --------- | --------- | ----------- |
| bg      | `#05070d` | `#eef1f6` | page        |
| surface | `#0c1018` | `#f7f8fb` | cards       |
| ink     | `#e8edf5` | `#10141c` | text        |
| muted   | `#8b95a8` | `#5c6578` | secondary   |
| faint   | `#7c869a` | `#646d80` | tertiary    |
| accent  | `#26b088` | `#0a7a58` | CTA / live  |
| focus   | `#6fc0dd` | `#0b5f7a` | focus ring  |
| danger  | `#ff8b8b` | `#b42318` | form errors |

Every text token clears WCAG AA (4.5:1) on its own surface in both themes;
`faint` and light-theme `danger` are set from that requirement, not by eye.
Accent is a muted green. Headings stay ink; accent is for the primary action only.

## Type

- Display: **Space Grotesk** 500–700, tracking tight on large sizes
- Body: **Manrope** 400–600
- No mono font, no uppercase letter-spaced labels

Scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64 / clamp(hero)

## Radius

8 (buttons, inputs, links) / 12 (cards) / pill (filter chips only)

## Motion

- micro 120ms, standard 260ms, large 480ms
- ease: `cubic-bezier(0.22, 1, 0.36, 1)`
- expressive layer (assets/motion.css, assets/motion.js): `--ease-expo`
  `cubic-bezier(0.16, 1, 0.3, 1)`
- hero: words rise from a mask (`translateY(112%) rotate(9deg)`, 1.6s, 70ms
  step), name, lead, stats and actions fade up 24px; the 3D hall keeps its own
  camera dolly and placard rise
- wheel scroll is damped (lerp 0.085 at 60 Hz) outside the snapping hero
  track; in-page anchors glide 1.8s expo-out with hero snapping paused
- section headings rise line by line from a mask, blocks fade up 24px, once,
  only for content that starts below the first viewport
- home showroom stage unfolds (`rotateX 24° → 0`, scale 0.96 → 1) and its
  slabs drift ±3.5% of the stage height; hover zooms the stage world to 1.04
  over 1.6s
- fine pointer only: dot + trailing ring cursor (hover 54px, labelled 86px on
  the front hero slab), magnetic hero, header and back-to-top buttons
  (0.28 / 0.38 of the offset)
- footer and mail links draw an underline from the left and leave to the
  right (600ms, 220ms delay)
- theme switch: circular View Transition from the click point, 700ms
- top scroll progress line, 2px, 55% ink
- reduced-motion: no smoothing, cursor, scrub, reveal or wipe; every element
  is in its final state from the first frame

## Interaction

- Touch targets ≥ 44px on every link, button, chip and summary
- Focus ring on all tabbable elements
- Contact: one form, one primary action, direct links as plain text

## Depth

Cards separate with a 1px border and no shadow. One neutral shadow is allowed
only on a real overlay (mobile menu drawer). No gradients, glows or blur.
