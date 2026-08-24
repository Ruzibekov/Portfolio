# Portfolio — design tokens

## Positioning

Shavkat Ruzibekov — product engineer portfolio. Tone: quiet engineering, not a
template landing. No decorative orbs, no marquee, no neon glow: hierarchy,
typography and real project screenshots carry the page.

## Palette

| Token   | Dark      | Light     | Role          |
| ------- | --------- | --------- | ------------- |
| bg      | `#05070d` | `#eef1f6` | page          |
| surface | `#0c1018` | `#f7f8fb` | cards         |
| ink     | `#e8edf5` | `#10141c` | text          |
| muted   | `#8b95a8` | `#5c6578` | secondary     |
| faint   | `#7c869a` | `#646d80` | tertiary      |
| accent  | `#26b088` | `#0a7a58` | CTA / live    |
| orbit   | `#6fc0dd` | `#0b5f7a` | lines / focus |
| warm    | `#f0a73a` | `#96620f` | badges        |

Every text token clears WCAG AA (4.5:1) on its own surface in both themes;
`faint` and light-theme `warm` are set from that requirement, not by eye.
Accent is a muted green — saturated neon mint reads as an AI template.

## Type

- Display: **Space Grotesk** 500–700, tracking tight on large sizes
- Body: **Manrope** 400–600
- Mono: **IBM Plex Mono** labels / rail

Scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64 / clamp(hero)

## Radius

6 / 14 / 22 / pill — nested: outer = inner + pad

## Motion

- micro 120ms, standard 260ms, large 480ms
- ease: `cubic-bezier(0.22, 1, 0.36, 1)`
- hero title rises line by line above 640px; below that the headline is balanced
  and shown without splitting
- reduced-motion: every reveal resolves to its final state

## Interaction

- Touch targets ≥ 44px on every link, button, chip and summary
- Focus ring on all tabbable elements; the section rail is markers only, its
  labels stay in the accessibility tree
- Contact: one form, one primary action, direct links as plain text

## Depth

Neutral shadows only. Surfaces separate with borders and elevation, never with
accent-tinted halos.
