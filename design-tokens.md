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
- sections and cards fade up 16px once; no tilt, magnetic or spotlight effects
- reduced-motion: every reveal resolves to its final state

## Interaction

- Touch targets ≥ 44px on every link, button, chip and summary
- Focus ring on all tabbable elements
- Contact: one form, one primary action, direct links as plain text

## Depth

Cards separate with a 1px border and no shadow. One neutral shadow is allowed
only on a real overlay (mobile menu drawer). No gradients, glows or blur.
