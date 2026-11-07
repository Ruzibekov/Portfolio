# DESIGN.md — portfolio redesign (B Index)

Visual source of truth: /home/ruzibekov/FL-Projects/frilans/design/portfolio-redesign/b-index/index.html (copy tokens from its :root; shared spring in ../shared/spring.css). Site content stays from this branch; only presentation changes.

## CONCEPT
Light typographic index: big tight headline, one signature "build" card, a Services bento of five link tiles, projects as rows in a white ledger panel. Cool grey canvas, ink black, one vermilion accent used only for the primary CTA, hover and focus.

## Tokens
colour roles:
- canvas s0 #EEF0F4, surface s1 #FFFFFF, raised s2 #E3E6EC, strong s3 #CBD0DA
- ink #0B0C0F, muted #515766, faint #585E6D, dark dk #0B0C0F, dk2 #1A1D24, on-dk #F4F5F8
- line #D5D9E1, line2 #AEB4C1
- accent #D63A1F, accent-hover #B02A12, accent-ink #FFFFFF, accent-soft #FBDAD2 (interactive only)
- header solid #EEF0F4, scrim rgba(11,12,15,.42)
- services band --band #E4E7EE (dark: transparent), shot well --well #D8DCE5 (dark #2D3340, 1.24 on tile #1F232C)
type: Inter Tight 600 headings (-.04em), 400 body 17px; IBM Plex Mono 11-14px labels and facts; H1 clamp(44px,5.3vw,78px), H2 clamp(34px,4.8vw,64px)
spacing: 8 / 16 / 24 / 40 / 72 / 112
radius: 8 / 14 / 22, pill 999
shadow (neutral only): 0 1px 2px rgba(10,12,16,.06), 0 16px 38px rgba(10,12,16,.14); sheet 0 2px 4px rgba(10,12,16,.08), 0 30px 70px rgba(10,12,16,.24); tile --sh-t 0 1px 2px rgba(10,12,16,.10), 0 14px 30px rgba(10,12,16,.12) (dark 0 1px 2px rgba(0,0,0,.4), 0 8px 20px rgba(0,0,0,.3))
no gradients, no coloured glow.

motion: UI 300ms snap spring (CSS linear() spring, --spring-snap), soft 310ms, pop 390ms for hero; ease-out cubic-bezier(.23,1,.32,1) for one-time wipes; transform/opacity/clip only; stagger 35-55ms. Hero: one-time 640ms entrance wipe (180ms delay), card tilt up to 7deg toward the pointer (touch: press-tilt), magnetic CTAs up to 9px (spring follower, lerp .16, `translate` property). Services: tiles rise in (translateY 34px, rotateX 9deg, 55ms stagger), each shot builds once at 35% visible (520ms wipe, 560ms scan line), replays for 280ms on hover or press, shot parallax by `animation-timeline: view()` with an IntersectionObserver fallback. Project index preview replays a 280ms clip reveal on row change. No scroll-jacking. prefers-reduced-motion: final state at once, no tilt, magnet, parallax or wipe.

signature: the sketch-to-product wipe: a pale grey ghost of the real shot, a vermilion scan line, then full colour. It is the hero entrance, the Services tile build and hover/press replay, and the project preview reveal. Plus the framed project preview anchored in the free right-hand space.

icons: Lucide, one set. logos: official Telegram, App Store, Google Play.
