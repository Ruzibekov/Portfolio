import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.json': 'application/json',
}
const storageTheme = 'sr-product-intelligence-theme'

let server
let browser
let origin
const consoleIssues = []

function resolveFile(pathname) {
  const clean = normalize(decodeURIComponent(pathname))
  const candidates = [
    join(dist, clean),
    join(dist, clean, 'index.html'),
    join(dist, `${clean}.html`),
  ]
  return candidates.find(
    (candidate) =>
      candidate.startsWith(dist + sep) &&
      existsSync(candidate) &&
      statSync(candidate).isFile(),
  )
}

before(async () => {
  if (!existsSync(join(dist, 'uz', 'index.html')))
    throw new Error('Run npm run build before the browser tests')
  server = createServer((request, response) => {
    const file = resolveFile(new URL(request.url, 'http://local').pathname)
    if (!file) {
      response.writeHead(404, { 'content-type': 'text/plain' })
      response.end('Not found')
      return
    }
    response.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
    })
    response.end(readFileSync(file))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch()
})

after(async () => {
  await browser?.close()
  await new Promise((resolve) => server?.close(resolve))
})

async function open(path, options = {}) {
  const width = options.width ?? 1280
  const phone = width < 600
  const context = await browser.newContext({
    viewport: { width, height: options.height ?? (phone ? 844 : 800) },
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: options.reduced ? 'reduce' : 'no-preference',
  })
  await context.addInitScript(() => {
    window.__rafCalls = 0
    const native = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) => {
      window.__rafCalls += 1
      return native(callback)
    }
  })
  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      consoleIssues.push(
        `console ${message.type()} ${path} ${width}: ${message.text()}`,
      )
  })
  page.on('pageerror', (error) =>
    consoleIssues.push(`pageerror ${path} ${width}: ${error.message}`),
  )
  await page.goto(origin + path, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(options.settle ?? 600)
  return { context, page }
}

const frontKey = (page) =>
  page.evaluate(
    () => document.querySelector('.hero-slab.is-front')?.dataset.key ?? null,
  )

const stageKey = (page) =>
  page.evaluate(
    () =>
      document.querySelector('#work .sr-slab[data-slot="0"]')?.dataset.key ??
      null,
  )

const currentRow = (page, scope = '#work') =>
  page.evaluate(
    (selector) =>
      document
        .querySelector(`${selector} [data-row][aria-current="true"]`)
        ?.closest('.sr-item').dataset.key ?? null,
    scope,
  )

async function scrollToStep(page, index) {
  await page.evaluate((step) => {
    const track = document.querySelector('[data-hero-track]')
    const anchor = document.querySelectorAll('.hero-step')[step]
    window.scrollTo(
      0,
      track.getBoundingClientRect().top + window.scrollY + anchor.offsetTop,
    )
  }, index)
  await page.waitForTimeout(1400)
}

describe('home hero scene', () => {
  test('camera follows scroll and the placard matches the front slab at 1280', async () => {
    const { context, page } = await open('/uz/')
    assert.equal(await frontKey(page), 'agentmama')
    await scrollToStep(page, 2)
    const key = await frontKey(page)
    assert.equal(key, 'besttracker')
    const placard = await page.evaluate(
      () => document.querySelector('.placard.is-front')?.dataset.key,
    )
    assert.equal(placard, key)
    const visible = await page.evaluate(
      () =>
        [...document.querySelectorAll('.hero-slab')].filter(
          (figure) =>
            !figure.classList.contains('is-out') &&
            Number(getComputedStyle(figure).opacity) > 0.05,
        ).length,
    )
    assert.ok(visible <= 3, `At most three slabs may show, saw ${visible}`)
    await context.close()
  })

  test('camera follows scroll on phones at 390', async () => {
    const { context, page } = await open('/uz/', { width: 390 })
    assert.equal(await frontKey(page), 'besttracker')
    await page.evaluate(() => window.scrollTo(0, 260))
    await page.waitForTimeout(1200)
    assert.equal(await frontKey(page), 'agentmama')
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('.minimap-dot')]
        .filter((dot) => getComputedStyle(dot).display !== 'none')
        .map((dot) => dot.getAttribute('aria-label')),
    )
    assert.deepEqual(
      labels.map((label) => label.split('.')[0]),
      ['1', '2', '3'],
    )
    await context.close()
  })

  test('minimap rail answers arrow, Home and End keys', async () => {
    const { context, page } = await open('/uz/')
    await page.focus('.minimap-dot[aria-current="step"]')
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(1400)
    assert.equal(await frontKey(page), 'majiidtv')
    assert.equal(
      await page.evaluate(
        () => document.activeElement.getAttribute('aria-current') === 'step',
      ),
      true,
    )
    await page.keyboard.press('End')
    await page.waitForTimeout(1600)
    assert.equal(await frontKey(page), 'wottank')
    await page.keyboard.press('Home')
    await page.waitForTimeout(1600)
    assert.equal(await frontKey(page), 'agentmama')
    await context.close()
  })

  test('animation frames stop when the hero is off screen or hidden', async () => {
    const { context, page } = await open('/uz/')
    await page.evaluate(() =>
      document.querySelector('#process').scrollIntoView(),
    )
    await page.waitForTimeout(1500)
    const offscreen = await page.evaluate(() => window.__rafCalls)
    await page.mouse.wheel(0, 200)
    await page.waitForTimeout(1000)
    assert.equal(await page.evaluate(() => window.__rafCalls), offscreen)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1500)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(300)
    const hidden = await page.evaluate(() => window.__rafCalls)
    await page.evaluate(() => {
      window.scrollTo(0, 200)
      window.dispatchEvent(new Event('scroll'))
    })
    await page.waitForTimeout(800)
    assert.equal(await page.evaluate(() => window.__rafCalls), hidden)
    await context.close()
  })

  test('reduced motion shows the final state without travel', async () => {
    const { context, page } = await open('/uz/', { reduced: true })
    const state = await page.evaluate(() => ({
      track: document.querySelector('[data-hero-track]').offsetHeight,
      viewport: window.innerHeight,
      travel: document.documentElement.classList.contains('scene-travel'),
      placardTransition: getComputedStyle(
        document.querySelector('.placard.is-front'),
      ).transitionDuration,
    }))
    assert.equal(state.travel, false)
    assert.equal(state.track, state.viewport)
    assert.ok(
      state.placardTransition
        .split(',')
        .every((value) => parseFloat(value) <= 0.001),
      state.placardTransition,
    )
    await page.click('.minimap-dot[data-d="3"]')
    await page.waitForTimeout(100)
    assert.equal(await frontKey(page), 'miyolo')
    assert.equal(await page.evaluate(() => window.scrollY), 0)
    await context.close()
  })
})

describe('home showroom', () => {
  test('filter chips reveal exactly the rows they promise', async () => {
    const { context, page } = await open('/uz/')
    for (const filter of ['web', 'mobile', 'all']) {
      await page.click(`#work [data-filter="${filter}"]`)
      await page.waitForTimeout(500)
      const state = await page.evaluate((name) => {
        const rows = [...document.querySelectorAll('#work .sr-item')].filter(
          (item) => !item.hidden,
        )
        return {
          rows: rows.length,
          match: rows.every(
            (item) =>
              name === 'all' || item.dataset.category.split(' ').includes(name),
          ),
          badge: document.querySelector(`#work [data-filter="${name}"] b`),
          status: document.querySelector('#work [data-filter-status]')
            .textContent,
          pressed: document
            .querySelector(`#work [data-filter="${name}"]`)
            .getAttribute('aria-pressed'),
        }
      }, filter)
      assert.ok(state.rows > 0 && state.rows <= 8)
      assert.equal(state.match, true)
      assert.equal(state.badge, null)
      assert.ok(state.status.includes(String(state.rows)))
      assert.equal(state.pressed, 'true')
    }
    await context.close()
  })

  test('arrow keys keep focus on the equivalent control and wrap around', async () => {
    const { context, page } = await open('/uz/')
    await page.evaluate(() => document.querySelector('#work').scrollIntoView())
    await page.waitForTimeout(600)
    const total = await page.evaluate(
      () =>
        [...document.querySelectorAll('#work .sr-item')].filter(
          (item) => !item.hidden,
        ).length,
    )
    await page.focus('#work .sr-open')
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    assert.equal(await currentRow(page), 'majiidtv')
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.matches('#work .sr-open'),
      ),
      true,
    )
    await page.keyboard.press('ArrowLeft')
    await page.focus('#work .sr-live')
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.matches('#work .sr-live, #work .sr-open'),
      ),
      true,
    )
    await page.keyboard.press('Home')
    await page.focus('#work [data-step="-1"]')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    const last = await page.evaluate(
      (count) =>
        [...document.querySelectorAll('#work .sr-item')].filter(
          (item) => !item.hidden,
        )[count - 1].dataset.key,
      total,
    )
    assert.equal(await currentRow(page), last)
    const prev = await page.evaluate(() => ({
      focused: document.activeElement.matches('#work [data-step="-1"]'),
      disabled: document.querySelector('#work [data-step="-1"]').disabled,
    }))
    assert.deepEqual(prev, { focused: true, disabled: false })
    await page.focus('#work [data-step="1"]')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(700)
    assert.equal(await currentRow(page), 'agentmama')
    assert.equal(await stageKey(page), 'agentmama')
    const sides = await page.evaluate(() =>
      ['-1', '1'].map(
        (slot) =>
          document.querySelector(`#work .sr-slab[data-slot="${slot}"]`)?.dataset
            .key ?? null,
      ),
    )
    assert.equal(sides[0], last)
    assert.ok(sides[1])
    await context.close()
  })

  test('detail sheet traps Tab, closes on Escape and restores focus at 390', async () => {
    const { context, page } = await open('/uz/', { width: 390 })
    await page.evaluate(() => document.querySelector('#work').scrollIntoView())
    await page.click('#work [data-row]:not([aria-current]) >> nth=0')
    await page.waitForTimeout(500)
    const opener = page.locator('#work [data-open-sheet]')
    await opener.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.matches('[data-sheet-close]'),
      ),
      true,
    )
    const count = await page.evaluate(
      () =>
        [
          ...document
            .querySelector('[data-sheet]')
            .querySelectorAll('a[href], button:not([disabled])'),
        ].filter((element) => element.getClientRects().length).length,
    )
    for (let index = 0; index < count + 2; index += 1) {
      await page.keyboard.press('Tab')
      assert.equal(
        await page.evaluate(() =>
          Boolean(document.activeElement.closest('[data-sheet]')),
        ),
        true,
      )
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    const closed = await page.evaluate(() => ({
      open: document
        .querySelector('[data-sheet]')
        .classList.contains('is-open'),
      focus: document.activeElement.matches('#work [data-open-sheet]'),
    }))
    assert.deepEqual(closed, { open: false, focus: true })
    await context.close()
  })

  test('back from a case page restores the selected project', async () => {
    const { context, page } = await open('/uz/')
    await page.evaluate(() => document.querySelector('#work').scrollIntoView())
    await page.click('#work [data-step="1"]')
    await page.click('#work [data-step="1"]')
    await page.waitForTimeout(700)
    assert.equal(await currentRow(page), 'miyolo')
    await Promise.all([
      page.waitForURL(/\/uz\/work\/miyolo$/),
      page.click('#work .sr-open'),
    ])
    await page.goBack({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    assert.equal(await currentRow(page), 'miyolo')
    assert.equal(await stageKey(page), 'miyolo')
    await context.close()
  })
})

describe('work index', () => {
  test('chip counts equal the rows they reveal', async () => {
    const { context, page } = await open('/uz/work/')
    for (const filter of ['web', 'mobile', 'all']) {
      await page.click(`[data-filter="${filter}"]`)
      await page.waitForTimeout(500)
      const state = await page.evaluate(
        (name) => ({
          badge: Number(
            document.querySelector(`[data-filter="${name}"] b`).textContent,
          ),
          rows: [...document.querySelectorAll('.sr-item')].filter(
            (item) => !item.hidden,
          ).length,
        }),
        filter,
      )
      assert.equal(state.rows, state.badge)
    }
    await context.close()
  })

  test('a malformed hash does not break the page', async () => {
    const { context, page } = await open('/uz/work/#%E0', { width: 1280 })
    await page.click('[data-step="1"]')
    await page.waitForTimeout(400)
    assert.equal(await currentRow(page, '[data-showroom]'), 'majiidtv')
    await context.close()
  })
})

describe('site chrome', () => {
  test('theme choice persists across reload and pages', async () => {
    const { context, page } = await open('/uz/')
    await page.click('[data-theme-toggle]')
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), storageTheme),
      'light',
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.theme),
      'light',
    )
    await page.goto(`${origin}/uz/work/`, { waitUntil: 'domcontentloaded' })
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.theme),
      'light',
    )
    await context.close()
  })

  test('language switch keeps the page and the locale sticks to links', async () => {
    const { context, page } = await open('/uz/work/agentmama', { width: 390 })
    await page.click('[data-language-picker] summary')
    await Promise.all([
      page.waitForURL(/\/ru\/work\/agentmama$/),
      page.click('[data-language-picker] a[hreflang="ru"]'),
    ])
    const state = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      links: [...document.querySelectorAll('.nav a[href^="/"]')]
        .filter((link) => !link.closest('[data-language-picker]'))
        .map((link) => link.getAttribute('href')),
    }))
    assert.equal(state.lang, 'ru')
    assert.ok(state.links.length > 0)
    assert.ok(
      state.links.every((href) => href.startsWith('/ru')),
      state.links,
    )
    await context.close()
  })

  test('no horizontal overflow at 360 and 390', async () => {
    for (const width of [360, 390]) {
      for (const path of [
        '/uz/',
        '/ru/',
        '/uz/work/',
        '/uz/work/agentmama',
        '/uz/services/web-development',
      ]) {
        const { context, page } = await open(path, { width, settle: 300 })
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        assert.equal(overflow, 0, `${path} overflows at ${width}`)
        await context.close()
      }
    }
  })

  test('phone tap targets in the first viewport are at least 44 px', async () => {
    for (const path of ['/uz/', '/ru/']) {
      const { context, page } = await open(path, { width: 390, settle: 1200 })
      for (const section of [null, '#work']) {
        if (section) {
          await page.evaluate(
            (selector) => document.querySelector(selector).scrollIntoView(),
            section,
          )
          await page.waitForTimeout(900)
        }
        const small = await page.evaluate(() =>
          [...document.querySelectorAll('a[href], button:not([disabled])')]
            .filter((element) => {
              const rect = element.getBoundingClientRect()
              const style = getComputedStyle(element)
              const shown =
                rect.width > 0 &&
                rect.bottom > 0 &&
                rect.top < window.innerHeight &&
                style.visibility !== 'hidden' &&
                style.pointerEvents !== 'none' &&
                !element.closest('[inert]')
              return shown && (rect.width < 44 || rect.height < 44)
            })
            .map(
              (element) =>
                `${element.className} ${element.textContent.trim().slice(0, 24)}`,
            ),
        )
        assert.deepEqual(small, [], `${path} ${section ?? 'hero'}`)
      }
      const hidden = await page.evaluate(
        () =>
          [
            ...document.querySelectorAll(
              '.hero-slab:not(.is-front) a.slab-url, .sr-slab:not([data-slot="0"]) a.slab-url',
            ),
          ].filter(
            (link) =>
              getComputedStyle(link).pointerEvents !== 'none' ||
              link.tabIndex >= 0,
          ).length,
      )
      assert.equal(hidden, 0)
      await context.close()
    }
  })

  test('preloaded fonts are fetched once and used', async () => {
    for (const path of ['/uz/', '/ru/']) {
      const requests = new Map()
      const { context, page } = await open(path, { width: 390, settle: 0 })
      page.on('request', (request) => {
        const url = request.url()
        if (url.includes('/assets/fonts/'))
          requests.set(url, (requests.get(url) ?? 0) + 1)
      })
      await page.reload({ waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(3600)
      const preloads = await page.evaluate(() =>
        [...document.querySelectorAll('link[rel="preload"][as="font"]')].map(
          (link) => link.href,
        ),
      )
      assert.ok(preloads.length > 0)
      for (const href of preloads) assert.equal(requests.get(href), 1, href)
      for (const [url, count] of requests) assert.equal(count, 1, url)
      await context.close()
    }
  })

  test('no console errors or warnings were logged', () => {
    assert.deepEqual(consoleIssues, [])
  })
})
