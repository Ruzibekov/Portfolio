import { readFileSync } from 'node:fs'
import { stylesheet } from './assets.mjs'
import { spriteMarkup } from './icons.mjs'
import { slab } from './slab.mjs'
import { floorPath, heroTitle } from './home.mjs'
import { escapeHtml } from './shared.mjs'

const readJson = (path) =>
  JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'))

const floorBase = {
  p: 1400,
  x0: -2400,
  x1: 2400,
  z1: 600,
  cell: 160,
}

export const ogVariants = [
  {
    name: 'wide',
    width: 1200,
    height: 630,
    targets: ['assets/og-products.png', 'og-image.png'],
    floor: { ...floorBase, ox: 820, oy: 200, y: 470, z0: -1100 },
    stand: [
      [
        'agentmama',
        'translate3d(170px, 60px, 0) rotateY(-28deg) scale(0.94)',
        0,
      ],
      [
        'majiidtv',
        'translate3d(-39px, -102px, -1300px) rotateY(-20deg) scale(1.04)',
        0.3,
      ],
      [
        'besttracker',
        'translate3d(-538px, -101px, -2200px) rotateY(-16deg) scale(1.18)',
        0.45,
      ],
    ],
    copy: { top: 72, title: 64, line: 68 },
  },
  {
    name: 'square',
    width: 1200,
    height: 1200,
    targets: ['assets/og-products-square.png'],
    floor: { ...floorBase, ox: 600, oy: 640, y: 520, z0: -1300 },
    stand: [
      [
        'agentmama',
        'translate3d(284px, 150px, 0) rotateY(-24deg) scale(1.3)',
        0,
      ],
      [
        'majiidtv',
        'translate3d(-330px, 60px, -1300px) rotateY(-20deg) scale(1.3)',
        0.3,
      ],
      [
        'besttracker',
        'translate3d(-1020px, 10px, -2200px) rotateY(-16deg) scale(1.3)',
        0.45,
      ],
    ],
    copy: { top: 72, title: 80, line: 84 },
  },
]

const styles = ({ width, height, floor, copy }) => `
html, body { margin: 0; background: var(--canvas); }
.og {
  position: relative;
  width: ${width}px;
  height: ${height}px;
  overflow: hidden;
  background: var(--canvas);
  color: var(--ink);
}
.og-floor {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: var(--line);
  stroke-width: 1.5;
}
.og-hall {
  position: absolute;
  inset: 0;
  perspective: ${floor.p}px;
  perspective-origin: ${floor.ox}px ${floor.oy}px;
}
.og-world {
  position: absolute;
  left: ${floor.ox}px;
  top: ${floor.oy}px;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
}
.og-world .slab {
  position: absolute;
  backface-visibility: hidden;
}
.og-world .slab-browser {
  left: -300px;
  top: -188px;
  width: 600px;
  height: 376px;
}
.og-world .slab-phone {
  left: -105px;
  top: -228px;
  width: 210px;
  height: 456px;
  padding: 7px;
  border-radius: var(--r-phone);
}
.og-world .slab-phone .slab-screen {
  border-radius: 24px;
}
.og-copy {
  position: absolute;
  left: 64px;
  top: ${copy.top}px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.og-name {
  margin: 0;
  font: 700 40px/1.2 var(--font-ui);
}
.og .h1 {
  margin: 40px 0 0;
  font-size: ${copy.title}px;
  line-height: ${copy.line}px;
}
.og-strap {
  margin: 28px 0 0;
  color: var(--muted);
  font: 400 32px/1.3 var(--font-ui);
}
`

export function renderOg(variant) {
  const { width, height, floor, stand } = variant
  const cases = readJson('content/cases.json').cases
  const words = readJson('content/portfolio-b.json').uz
  const strap = readJson('content/locales/presentation.json').locales.uz.contact
    .strap
  const slabs = stand
    .map(([key, transform, dim]) => {
      const item = cases.find((entry) => entry.key === key)
      if (!item?.screen) throw new Error(`OG slab needs a capture: ${key}`)
      const markup = slab({
        item,
        words: item.translations.uz,
        sizes: '1400px',
        lazy: false,
        priority: true,
        hidden: true,
        attributes: ` style="transform:${transform}" data-og-slab`,
      })
      const dimTag = '<span class="slab-dim" aria-hidden="true" data-dim>'
      if (!markup.includes(dimTag)) throw new Error('Slab dim layer changed')
      return markup.replace(
        dimTag,
        `<span class="slab-dim" aria-hidden="true" data-dim style="opacity:${dim}">`,
      )
    })
    .reverse()
    .join('')
  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${stylesheet.path}">
<style>${styles(variant)}</style>
</head>
<body>${spriteMarkup}<div class="og" data-og><svg class="og-floor" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="${floorPath({ ...floor, w: width, h: height })}"/></svg><div class="og-hall"><div class="og-world">${slabs}</div></div><div class="og-copy" data-og-copy><p class="og-name" data-og-text>Shavkatbek Ruzibekov</p><h1 class="h1">${heroTitle(words.title, escapeHtml)}</h1><p class="og-strap" data-og-text>${escapeHtml(strap)}</p></div></div></body>
</html>`
}
