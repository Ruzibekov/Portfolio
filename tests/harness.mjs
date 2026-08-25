import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

export const startServer = () =>
  new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const path = decodeURIComponent(req.url.split('?')[0])
      const rel = normalize(path === '/' ? '/index.html' : path).replace(
        /^(\.\.[/\\])+/,
        '',
      )
      try {
        const body = await readFile(join(ROOT, rel))
        res.writeHead(200, {
          'content-type': MIME[extname(rel)] || 'application/octet-stream',
        })
        res.end(body)
      } catch {
        res.writeHead(404).end('not found')
      }
    })
    server.listen(0, '127.0.0.1', () =>
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(done)),
      }),
    )
  })

let shared = null

export const getBrowser = async () => {
  if (shared && shared.isConnected()) return shared
  shared = await chromium.launch()
  return shared
}

export const closeBrowser = async () => {
  if (!shared) return
  await shared.close().catch(() => {})
  shared = null
}

export const openPage = async (origin, options = {}) => {
  const {
    theme = 'dark',
    lang = 'ru',
    width = 1440,
    height = 900,
    reducedMotion,
  } = options
  const browser = await getBrowser()
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion,
  })
  await context.addInitScript(
    ([storedTheme, storedLang]) => {
      try {
        localStorage.setItem('portfolio-anna-theme', storedTheme)
        localStorage.setItem('portfolio-anna-lang', storedLang)
      } catch {}
    },
    [theme, lang],
  )
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      problems.push(`${message.type()}: ${message.text()}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400)
      problems.push(`${response.status()} ${response.url()}`)
  })
  await page.goto(`${origin}/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await page.waitForTimeout(400)
  page.problems = problems
  page.closeContext = () => context.close()
  return page
}

export const scrollThrough = async (page) => {
  await page.evaluate(async () => {
    const height = document.body.scrollHeight
    for (let y = 0; y < height; y += 400) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 40))
    }
    window.scrollTo(0, 0)
  })
  await page
    .waitForFunction(
      () => document.getAnimations().every((a) => a.playState !== 'running'),
      null,
      { timeout: 8000 },
    )
    .catch(() => {})
  await page.waitForTimeout(300)
}

export const contrast = (foreground, background) => {
  const relative = (color) => {
    const channels = color.map((value) => {
      const v = value / 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const a = relative(foreground)
  const b = relative(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export const rgb = (value) => value.match(/\d+/g).slice(0, 3).map(Number)
