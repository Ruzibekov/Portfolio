const path = require('path')
const fs = require('fs')
const os = require('os')
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { MOBILE, WEB, SCENE } = require('./posters-config.cjs')

const ROOT = path.join(__dirname, '..')
const OUT = process.env.POSTER_OUT || path.join(ROOT, 'screenshots')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'posters-'))
const BG = process.env.POSTER_BG || '#E9ECEF'
const LINE = 'rgba(17, 19, 22, 0.12)'
const POSTER = { width: 1400, height: 933 }
const SCENE_SIZE = { width: 900, height: 600 }
const QUALITY = '82'

const only = (process.argv.find((a) => a.startsWith('--only=')) || '')
  .replace('--only=', '')
  .split(',')
  .filter(Boolean)
const wanted = (item) => only.length === 0 || only.includes(item.name)

const magick = (args) => execFileSync('magick', args).toString().trim()

const size = (file) => {
  const [w, h] = magick(['identify', '-format', '%w %h', `${file}[0]`])
    .split(' ')
    .map(Number)
  return { w, h }
}

const toUrl = (file) => 'file://' + path.resolve(ROOT, file)

const mobileLayout = (count, aspect) => {
  const padX = 110
  const padY = 84
  const gap = 40
  const maxH = POSTER.height - padY * 2
  const byWidth = (POSTER.width - padX * 2 - gap * (count - 1)) / count / aspect
  const h = Math.round(Math.min(maxH, byWidth))
  return { w: Math.round(h * aspect), h, gap }
}

const page = (body, extraCss = '') => `<!doctype html>
<html><head><style>
  * { margin: 0; box-sizing: border-box; }
  html, body { background: ${BG}; }
  .poster {
    width: ${POSTER.width}px;
    height: ${POSTER.height}px;
    background: ${BG};
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  img { display: block; width: 100%; }
  ${extraCss}
</style></head><body><div class="poster">${body}</div></body></html>`

const mobileHtml = (item) => {
  const files = item.screens.map((f) => path.resolve(ROOT, f))
  for (const f of files) if (!fs.existsSync(f)) throw new Error(`missing ${f}`)
  const first = size(files[0])
  const box = mobileLayout(files.length, first.w / first.h)
  const radius = Math.round(box.w * (item.radius || 0.06))
  const css = `
  .poster { gap: ${box.gap}px; }
  .screen {
    width: ${box.w}px;
    height: ${box.h}px;
    border: 1px solid ${LINE};
    border-radius: ${radius}px;
    overflow: hidden;
    background: #ffffff;
  }
  .screen img { height: 100%; object-fit: cover; object-position: top center; }`
  const body = files
    .map((f) => `<div class="screen"><img src="${toUrl(f)}" /></div>`)
    .join('')
  return page(body, css)
}

const webHtml = (item, raw) => {
  const width = 1180
  const label = new URL(item.url).host
  const css = `
  .win {
    width: ${width}px;
    border: 1px solid ${LINE};
    border-radius: 12px;
    overflow: hidden;
    background: #ffffff;
  }
  .bar {
    height: 36px;
    display: flex;
    align-items: center;
    padding: 0 18px;
    background: #f8f9fa;
    border-bottom: 1px solid ${LINE};
    color: #5f6670;
    font: 500 13px/1 -apple-system, 'Segoe UI', Roboto, sans-serif;
    letter-spacing: 0.1px;
  }`
  const body = `<div class="win"><div class="bar">${label}</div><img src="${toUrl(raw)}" /></div>`
  return page(body, css)
}

const capture = async (browser, item, viewport, file) => {
  const tab = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  const res = await tab.goto(item.url, { waitUntil: 'load', timeout: 60000 })
  if (!res || !res.ok())
    throw new Error(`${item.url} -> ${res && res.status()}`)
  await tab.waitForTimeout(item.wait || 4500)
  if (item.accept) {
    const btn = tab.getByText(/^(accept|принять|accept all)$/i).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click()
      await tab.waitForTimeout(800)
    }
  }
  await tab.screenshot({ path: file })
  await tab.close()
}

const webSource = async (browser, item) => {
  const raw = path.join(TMP, `${item.name}-raw.png`)
  try {
    await capture(browser, item, { width: 1280, height: 800 }, raw)
    return raw
  } catch (e) {
    if (!item.fallback) throw e
    console.warn(
      `${item.name}: live capture failed (${e.message.split('\n')[0]}), using ${item.fallback}`,
    )
    return path.resolve(ROOT, item.fallback)
  }
}

const render = async (browser, html, name) => {
  const htmlFile = path.join(TMP, `${name}.html`)
  const png = path.join(TMP, `${name}-poster.png`)
  fs.writeFileSync(htmlFile, html)
  const tab = await browser.newPage({
    viewport: { width: POSTER.width, height: POSTER.height },
    deviceScaleFactor: 1,
  })
  await tab.goto('file://' + htmlFile, { waitUntil: 'load' })
  await tab.evaluate(() =>
    Promise.all([...document.images].map((i) => i.decode())),
  )
  await tab.locator('.poster').screenshot({ path: png })
  await tab.close()
  return png
}

const save = (png, name, target) => {
  const out = path.join(OUT, `${name}-shot.webp`)
  magick([
    png,
    '-resize',
    `${target.width}x${target.height}^`,
    '-gravity',
    'center',
    '-extent',
    `${target.width}x${target.height}`,
    '-quality',
    QUALITY,
    out,
  ])
  const got = size(out)
  if (got.w !== target.width || got.h !== target.height)
    throw new Error(`${name}: wrong size ${got.w}x${got.h}`)
  console.log(`${name}: ${got.w}x${got.h} ${fs.statSync(out).size} B`)
}

const main = async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  try {
    for (const item of MOBILE.filter(wanted)) {
      save(
        await render(browser, mobileHtml(item), item.name),
        item.name,
        POSTER,
      )
    }
    for (const item of WEB.filter(wanted)) {
      const raw = await webSource(browser, item)
      save(
        await render(browser, webHtml(item, raw), item.name),
        item.name,
        POSTER,
      )
    }
    for (const item of SCENE.filter(wanted)) {
      const raw = path.join(TMP, `${item.name}-raw.png`)
      await capture(browser, item, { width: 1440, height: 960 }, raw)
      save(raw, item.name, SCENE_SIZE)
    }
  } finally {
    await browser.close()
    fs.rmSync(TMP, { recursive: true, force: true })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
