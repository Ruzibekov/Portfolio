import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { ogVariants, renderOg } from './site/og.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const clearance = 24
const frame = 32
const host = 'http://og.local'
const types = {
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

if (!existsSync(join(dist, 'uz', 'index.html')))
  throw new Error('Run npm run build before rendering the OG image')

function layout() {
  const box = (rect) => ({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  })
  const textBox = (element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return box(range.getBoundingClientRect())
  }
  const texts = [
    ...document.querySelectorAll('[data-og-text], [data-og-copy] .h1-line'),
  ].map((element) => ({ label: element.textContent, ...textBox(element) }))
  const slabs = [...document.querySelectorAll('[data-og-slab]')].map(
    (element) => ({
      label: element.dataset.key,
      ...box(element.getBoundingClientRect()),
    }),
  )
  return { texts, slabs }
}

async function renderVariant(page, variant) {
  await page.setViewportSize({ width: variant.width, height: variant.height })
  await page.goto(`${host}/${variant.name}`, {
    waitUntil: 'load',
    timeout: 60000,
  })
  await page.evaluate(() => document.fonts.ready)
  const state = await page.evaluate(() => ({
    images: [...document.images].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
    fonts: ['500 64px Unbounded', '700 40px Onest'].every((font) =>
      document.fonts.check(font),
    ),
  }))
  if (!state.images) throw new Error('OG slab capture failed to load')
  if (!state.fonts) throw new Error('OG fonts failed to load')
  const { texts, slabs } = await page.evaluate(layout)
  for (const slab of slabs)
    if (
      slab.left < frame ||
      slab.top < frame ||
      slab.right > variant.width - frame ||
      slab.bottom > variant.height - frame
    )
      throw new Error(
        `${variant.name}: slab ${JSON.stringify(slab)} leaves the ${frame}px frame`,
      )
  for (const text of texts) {
    if (text.left < 48 || text.top < 48 || text.right > variant.width - 48)
      throw new Error(
        `${variant.name}: "${text.label}" is too close to the edge`,
      )
    for (const slab of slabs) {
      const apart =
        slab.left >= text.right + clearance ||
        slab.right <= text.left - clearance ||
        slab.top >= text.bottom + clearance ||
        slab.bottom <= text.top - clearance
      if (!apart)
        throw new Error(
          `${variant.name}: slab ${JSON.stringify(slab)} is within ${clearance}px of ${JSON.stringify(text)}`,
        )
    }
  }
  const scratch = mkdtempSync(join(tmpdir(), 'og-'))
  try {
    const raw = join(scratch, 'render.png')
    await page.locator('[data-og]').screenshot({ path: raw, type: 'png' })
    const [first, ...copies] = variant.targets
    const output = join(root, first)
    execFileSync('python3', [
      join(root, 'scripts/optimize-og.py'),
      raw,
      output,
      String(variant.width),
      String(variant.height),
    ])
    const image = readFileSync(output)
    for (const target of copies) writeFileSync(join(root, target), image)
    console.log(
      `Rendered ${variant.width}x${variant.height} OG image (${Math.round(image.length / 1024)} KB) to ${variant.targets.join(', ')}`,
    )
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  const failed = []
  await page.route(`${host}/**`, (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname)
    const variant = ogVariants.find((entry) => path === `/${entry.name}`)
    if (variant) {
      route.fulfill({ contentType: 'text/html', body: renderOg(variant) })
      return
    }
    const file = join(dist, path)
    if (!file.startsWith(dist) || !existsSync(file)) {
      failed.push(path)
      route.fulfill({ status: 404, body: '' })
      return
    }
    route.fulfill({
      contentType: types[extname(file)] ?? 'application/octet-stream',
      body: readFileSync(file),
    })
  })
  for (const variant of ogVariants) await renderVariant(page, variant)
  if (failed.length) throw new Error(`OG assets missing: ${failed.join(', ')}`)
} finally {
  await browser.close()
}
