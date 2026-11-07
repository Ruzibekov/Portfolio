# DESIGN.md — portfolio redesign (B Index)

Visual source of truth: /home/ruzibekov/FL-Projects/frilans/design/portfolio-redesign/b-index/index.html (copy tokens from its :root; shared spring in ../shared/spring.css). Site content stays from this branch; only presentation changes.

## CONCEPT
Light typographic index: big tight headline, one signature "build" card, projects as rows in a white ledger panel. Cool grey canvas, ink black, one vermilion accent used only for the primary CTA, hover and focus.

## Tokens
colour roles:
- canvas s0 #EEF0F4, surface s1 #FFFFFF, raised s2 #E3E6EC, strong s3 #CBD0DA
- ink #0B0C0F, muted #515766, faint #585E6D, dark dk #0B0C0F, dk2 #1A1D24, on-dk #F4F5F8
- line #D5D9E1, line2 #AEB4C1
- accent #D63A1F, accent-hover #B02A12, accent-ink #FFFFFF, accent-soft #FBDAD2 (interactive only)
- header solid #EEF0F4, scrim rgba(11,12,15,.42)
type: Inter Tight 600 headings (-.04em), 400 body 17px; IBM Plex Mono 11-14px labels and facts; H1 clamp(44px,5.3vw,78px), H2 clamp(34px,4.8vw,64px)
spacing: 8 / 16 / 24 / 40 / 72 / 112
radius: 8 / 14 / 22, pill 999
shadow (neutral only): 0 1px 2px rgba(10,12,16,.06), 0 16px 38px rgba(10,12,16,.14); sheet 0 2px 4px rgba(10,12,16,.08), 0 30px 70px rgba(10,12,16,.24)
no gradients, no coloured glow.

motion: UI 300ms snap spring (CSS linear() spring, --spring-snap), soft 310ms, pop 390ms for hero; ease-out cubic-bezier(.2,.9,.25,1.06) fallback; transform/opacity only; stagger 35-55ms; hero build sequence 1.0s / 2.5s (one time); sheet spring, drag-to-dismiss with velocity; prefers-reduced-motion: no reveal, count, tilt or build animation (final state shown).

signature: hero "build" card: real MonarhMarket shot revealed in 3 stages (grey sketch, half colour with vermilion scan line, full colour) synced to the H1 words; plus framed cursor-following project preview that tilts with pointer speed.

icons: Lucide, one set. logos: official Telegram, App Store, Google Play.
