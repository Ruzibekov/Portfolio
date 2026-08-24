# Portfolio — 3D Orbit art direction

## Positioning

Shavkat Ruzibekov — product engineer portfolio. Vibe: **deep-space orbital desk** — shipped apps as satellites around a builder core. Not SaaS Linear, not generic indigo.

## Palette

| Token   | Dark      | Light     | Role          |
| ------- | --------- | --------- | ------------- |
| bg      | `#05070d` | `#eef1f6` | page          |
| surface | `#0c1018` | `#f7f8fb` | cards         |
| ink     | `#e8edf5` | `#10141c` | text          |
| muted   | `#8b95a8` | `#5c6578` | secondary     |
| accent  | `#1ecf9a` | `#0f9f74` | CTA / live    |
| orbit   | `#4fd1ff` | `#1a8fb8` | rings / focus |
| warm    | `#f0a73a` | `#c48420` | highlight     |

Accent ≠ indigo. Orbit cyan is secondary semantic (lines, focus), not CTA fill.

## Type

- Display: **Space Grotesk** 500–700, tracking tight on large sizes
- Body: **Manrope** 400–600
- Mono: **IBM Plex Mono** labels / rail

Scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64 / clamp(hero)

## Radius

4 / 10 / 16 / 24 / pill — nested: outer = inner + pad

## Motion

- micro 120ms, standard 260ms, large 480ms
- ease: `cubic-bezier(0.22, 1, 0.36, 1)`
- orbit spin 48s linear; counter-rotate satellites
- reduced-motion: freeze orbits, static scene

## Hero subject

3D CSS orbit scene: core = avatar receipt card; 2 elliptical rings; 6 project satellites with real screenshots. Pointer tilt + auto-rotate.

## Depth

Starfield noise, layered radial glows, glass surfaces (`backdrop-filter`), multi-ring shadows with accent tint.
