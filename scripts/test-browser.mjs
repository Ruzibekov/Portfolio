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
let closingBrowser = false
const consoleIssues = []
const browserCrashes = []

async function launchBrowser(reason) {
  if (browser?.isConnected()) {
    closingBrowser = true
    await browser.close()
    closingBrowser = false
  }
  const launched = await chromium.launch()
  launched.on('disconnected', () => {
    if (closingBrowser || launched !== browser) return
    browserCrashes.push(reason)
    console.error(`# chromium disconnected unexpectedly in: ${reason}`)
  })
  browser = launched
}

function freshBrowser(group) {
  before(() => launchBrowser(group))
}

async function ready(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (page.isClosed()) return
    await page.waitForLoadState('domcontentloaded')
    try {
      await page.evaluate(() =>
        Promise.race([
          Promise.all(window.__transitions ?? []),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]),
      )
      return
    } catch (error) {
      if (!/Execution context was destroyed|navigation/i.test(error.message))
        throw error
    }
  }
  throw new Error(`${page.url()} kept navigating while the test closed it`)
}

async function done(context) {
  for (const page of context.pages()) await ready(page)
  await context.close()
}

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
})

after(async () => {
  closingBrowser = true
  await browser?.close()
  await new Promise((resolve) => server?.close(resolve))
  assert.deepEqual(browserCrashes, [], 'Chromium crashed during the suite')
})

async function open(path, options = {}) {
  if (!browser?.isConnected()) {
    browserCrashes.push(`relaunch before ${path}`)
    console.error(`# relaunching chromium before ${path}`)
    await launchBrowser(`relaunch before ${path}`)
  }
  const width = options.width ?? 1280
  const phone = width < 600
  const context = await browser.newContext({
    viewport: { width, height: options.height ?? (phone ? 844 : 800) },
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: options.reduced ? 'reduce' : 'no-preference',
  })
  await context.addInitScript(() => {
    window.__transitions = []
    const track = (transition) => {
      if (transition)
        window.__transitions.push(
          transition.finished.then(
            () => 'finished',
            () => 'skipped',
          ),
        )
    }
    window.addEventListener('pageswap', (event) => track(event.viewTransition))
    window.addEventListener('pagereveal', (event) =>
      track(event.viewTransition),
    )
    const native = Document.prototype.startViewTransition
    if (native)
      Document.prototype.startViewTransition = function (...args) {
        const transition = native.apply(this, args)
        track(transition)
        return transition
      }
  })
  await context.addInitScript(() => {
    window.__rafCalls = 0
    const native = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) => {
      window.__rafCalls += 1
      return native(callback)
    }
  })
  if (options.theme)
    await context.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [storageTheme, options.theme],
    )
  const page = await context.newPage()
  if (options.block) await page.route(options.block, (route) => route.abort())
  page.on('console', (message) => {
    if (options.block && message.text().startsWith('Failed to load resource'))
      return
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

const waitFront = (page, key) =>
  page.waitForFunction(
    (wanted) =>
      document.querySelector('.hero-slab.is-front')?.dataset.key === wanted,
    key,
    { timeout: 5000 },
  )

const waitStage = (page, key) =>
  page.waitForFunction(
    (wanted) =>
      document.querySelector('#work .sr-slab[data-slot="0"]')?.dataset.key ===
      wanted,
    key,
    { timeout: 5000 },
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

async function shadowSteps(page, frontSelector, containerSelector) {
  const strips = await page.evaluate(
    ([front, container]) => {
      const slab = document.querySelector(front).getBoundingClientRect()
      const box = document.querySelector(container)
      const frame = box.getBoundingClientRect()
      const width = document.documentElement.clientWidth
      const centre = Math.round(slab.left + slab.width / 2)
      const own = (x, y) => {
        const element = document.elementFromPoint(x, y)
        return !element || element.contains(box) || box.contains(element)
      }
      const top = Math.ceil(slab.bottom) + 2
      let bottom = top
      while (
        bottom < Math.min(frame.bottom + 4, innerHeight - 1) &&
        own(centre, bottom)
      )
        bottom += 1
      const row = Math.min(Math.round(slab.bottom) + 8, bottom - 1)
      let left = Math.floor(slab.left) - 2
      while (left > Math.max(0, frame.left - 4) && own(left - 1, row)) left -= 1
      let right = Math.ceil(slab.right) + 2
      while (
        right < Math.min(width - 1, frame.right + 4) &&
        own(right + 1, row)
      )
        right += 1
      return [
        {
          x: Math.round(slab.left + slab.width * 0.2),
          y: top,
          width: Math.round(slab.width * 0.6),
          height: bottom - top,
          axis: 'rows',
        },
        {
          x: left,
          y: row,
          width: Math.floor(slab.left) - 2 - left,
          height: 1,
          axis: 'columns',
        },
        {
          x: Math.ceil(slab.right) + 2,
          y: row,
          width: right - Math.ceil(slab.right) - 2,
          height: 1,
          axis: 'columns',
        },
      ]
    },
    [frontSelector, containerSelector],
  )
  const steps = []
  for (const strip of strips) {
    if (strip.axis === 'columns' ? strip.width < 2 : strip.height < 2) continue
    const png = await page.screenshot({
      clip: {
        x: strip.x,
        y: strip.y,
        width: strip.width,
        height: strip.height,
      },
    })
    const step = await page.evaluate(
      async ([data, axis]) => {
        const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
        const bitmap = await createImageBitmap(new Blob([bytes]))
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d')
        context.drawImage(bitmap, 0, 0)
        const {
          data: pixels,
          width,
          height,
        } = context.getImageData(0, 0, bitmap.width, bitmap.height)
        const light = (x, y) => {
          const index = (y * width + x) * 4
          return (
            0.2126 * pixels[index] +
            0.7152 * pixels[index + 1] +
            0.0722 * pixels[index + 2]
          )
        }
        let worst = 0
        if (axis === 'rows')
          for (let x = 0; x < width; x += 1)
            for (let y = 1; y < height; y += 1)
              worst = Math.max(worst, Math.abs(light(x, y) - light(x, y - 1)))
        else
          for (let y = 0; y < height; y += 1)
            for (let x = 1; x < width; x += 1)
              worst = Math.max(worst, Math.abs(light(x, y) - light(x - 1, y)))
        return worst
      },
      [png.toString('base64'), strip.axis],
    )
    steps.push({ ...strip, step: Math.round(step * 10) / 10 })
  }
  return steps
}

async function settle(page, timeout = 10000) {
  await page.evaluate(() => {
    window.__settle = { signature: '', same: 0 }
  })
  await page.waitForFunction(
    () => {
      const hero = document.querySelector('[data-hero]')
      const signature = [
        Math.round(window.scrollY),
        hero.querySelector('[data-world]').style.transform,
        hero.querySelector('[data-hall]').classList.contains('is-dragging'),
        ...[...hero.querySelectorAll('.hero-slab')].map(
          (figure) => `${figure.style.transform}${figure.style.opacity}`,
        ),
      ].join('|')
      const record = window.__settle
      record.same = signature === record.signature ? record.same + 1 : 0
      record.signature = signature
      return record.same >= 6
    },
    null,
    { polling: 50, timeout },
  )
}

async function stageSettle(page, timeout = 10000) {
  await page.evaluate(() => {
    window.__stage = { signature: '', same: 0 }
  })
  await page.waitForFunction(
    () => {
      const world = document.querySelector('#work [data-stage-world]')
      if (!world) return false
      const signature = [world, ...world.querySelectorAll('*')]
        .map((element) => {
          const style = getComputedStyle(element)
          return `${style.transform}${style.opacity}${style.display}`
        })
        .join('|')
      const record = window.__stage
      record.same = signature === record.signature ? record.same + 1 : 0
      record.signature = signature
      return record.same >= 6
    },
    null,
    { polling: 50, timeout },
  )
}

async function scrollToStep(page, index) {
  await page.evaluate((step) => {
    const track = document.querySelector('[data-hero-track]')
    const anchor = document.querySelectorAll('.hero-step')[step]
    window.scrollTo(
      0,
      track.getBoundingClientRect().top + window.scrollY + anchor.offsetTop,
    )
  }, index)
  await settle(page)
}

describe('home hero scene', () => {
  freshBrowser('home hero scene')

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
    await done(context)
  })

  test('camera follows scroll on phones at 390', async () => {
    const { context, page } = await open('/uz/', { width: 390 })
    assert.equal(await frontKey(page), 'besttracker')
    await page.evaluate(() => window.scrollTo(0, 260))
    await settle(page)
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
    await done(context)
  })

  test('minimap rail answers arrow, Home and End keys', async () => {
    const { context, page } = await open('/uz/')
    await page.focus('.minimap-dot[aria-current="step"]')
    await page.keyboard.press('ArrowRight')
    await settle(page)
    assert.equal(await frontKey(page), 'majiidtv')
    assert.equal(
      await page.evaluate(
        () => document.activeElement.getAttribute('aria-current') === 'step',
      ),
      true,
    )
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll('.minimap-dot')]
          .filter((dot) => getComputedStyle(dot).display !== 'none')
          .map((dot) => dot.tabIndex),
      ),
      [-1, 0, -1, -1, -1, -1],
    )
    await page.keyboard.press('End')
    await settle(page)
    assert.equal(await frontKey(page), 'wottank')
    await page.keyboard.press('Home')
    await settle(page)
    assert.equal(await frontKey(page), 'agentmama')
    await done(context)
  })

  test('animation frames stop when the hero is off screen or hidden', async () => {
    const { context, page } = await open('/uz/')
    await page.evaluate(() =>
      document.querySelector('#process').scrollIntoView(),
    )
    await settle(page)
    const offscreen = await page.evaluate(() => window.__rafCalls)
    await page.mouse.wheel(0, 200)
    await settle(page)
    assert.equal(await page.evaluate(() => window.__rafCalls), offscreen)
    await page.evaluate(() => window.scrollTo(0, 0))
    await settle(page)
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
    await done(context)
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
    await done(context)
  })
})

const frontBox = (page) =>
  page.evaluate(() => {
    const box = document
      .querySelector('.hero-slab.is-front')
      .getBoundingClientRect()
    return {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    }
  })

const buttonBits = { none: 0, left: 1, middle: 4, right: 2 }

async function timedMouse(page) {
  const session = await page.context().newCDPSession(page)
  let clock = Date.now() / 1000
  let held = 'none'
  let at = { x: 0, y: 0 }
  const send = (type, extra = {}) =>
    session.send('Input.dispatchMouseEvent', {
      type,
      x: at.x,
      y: at.y,
      timestamp: clock,
      button: held,
      buttons: buttonBits[held],
      ...extra,
    })
  return {
    async down(point, button = 'left') {
      at = point
      held = button
      await send('mousePressed', { clickCount: 1 })
    },
    async move(point, ms = 16) {
      clock += ms / 1000
      at = point
      await send('mouseMoved')
    },
    async up(ms = 0) {
      clock += ms / 1000
      const button = held
      held = 'none'
      await send('mouseReleased', {
        button,
        buttons: 0,
        clickCount: 1,
      })
    },
    detach: () => session.detach(),
  }
}

async function mouseDrag(page, from, dx, options = {}) {
  const moves = options.moves ?? 15
  const gap = options.gap ?? 16
  const mouse = await timedMouse(page)
  await mouse.down(from, options.button)
  for (let i = 1; i <= moves; i += 1)
    await mouse.move({ x: from.x + (dx * i) / moves, y: from.y }, gap)
  if (options.release !== false) await mouse.up(options.hold ?? 0)
  await mouse.detach()
}

const isDragging = (page) =>
  page.evaluate(() =>
    document.querySelector('[data-hall]').classList.contains('is-dragging'),
  )

async function touchDrag(context, page, from, to, steps = 14) {
  const session = await context.newCDPSession(page)
  const point = (t) => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point(0)],
  })
  for (let i = 1; i <= steps; i += 1) {
    await page.waitForTimeout(16)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point(i / steps)],
    })
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await session.detach()
}

const anchorTop = (page, index) =>
  page.evaluate((step) => {
    const track = document.querySelector('[data-hero-track]')
    const anchor = document.querySelectorAll('.hero-step')[step]
    return Math.round(
      track.getBoundingClientRect().top + window.scrollY + anchor.offsetTop,
    )
  }, index)

const heroState = (page) =>
  page.evaluate(() => {
    const front = document.querySelector('.hero-slab.is-front')
    const placard = document.querySelector('.placard.is-front')
    return {
      key: front?.dataset.key ?? null,
      placard: placard?.dataset.key ?? null,
      title: placard?.querySelector('.placard-title')?.textContent ?? '',
      live: document.querySelector('[data-hero-live]')?.textContent ?? '',
      scroll: Math.round(window.scrollY),
    }
  })

async function sampleCamera(page, action, duration = 1400) {
  await page.evaluate(() => {
    window.__camera = []
    const figure = document.querySelector('.hero-slab[data-d="1"]')
    const tick = () => {
      window.__camera.push(new DOMMatrix(figure.style.transform).m41)
      if (window.__camera.length < 400) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await action()
  await page.waitForTimeout(duration)
  const frames = await page.evaluate(() => window.__camera)
  let jump = 0
  for (let i = 1; i < frames.length; i += 1)
    jump = Math.max(jump, Math.abs(frames[i] - frames[i - 1]))
  return jump
}

describe('home hero swipe', () => {
  freshBrowser('home hero swipe')

  test('mouse drag follows the pointer and settles on the next and previous project', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    const box = await frontBox(page)
    const incoming = await page.evaluate(
      () =>
        document
          .querySelector('.hero-slab[data-key="majiidtv"]')
          .getBoundingClientRect().left,
    )
    const from = { x: box.left + box.width - 60, y: box.top + box.height / 2 }
    const mouse = await timedMouse(page)
    await mouse.down(from)
    for (let i = 1; i <= 10; i += 1)
      await mouse.move({ x: from.x - i * 10, y: from.y })
    await page.waitForFunction(
      (left) =>
        left -
          document
            .querySelector('.hero-slab[data-key="majiidtv"]')
            .getBoundingClientRect().left >
        40,
      incoming,
      { timeout: 5000 },
    )
    assert.equal(await isDragging(page), true)
    const far = await page.evaluate(() =>
      [...document.querySelectorAll('.hero-slab[data-d]')]
        .filter(
          (figure) =>
            Math.abs(Number(figure.dataset.d)) > 2 &&
            getComputedStyle(figure).visibility !== 'hidden' &&
            Number(getComputedStyle(figure).opacity) > 0.01,
        )
        .map((figure) => figure.dataset.key),
    )
    assert.deepEqual(far, [], 'slabs beyond two positions hide while dragging')
    for (let i = 11; i <= 24; i += 1)
      await mouse.move({ x: from.x - i * 10, y: from.y })
    await mouse.up()
    await mouse.detach()
    await settle(page)
    let state = await heroState(page)
    assert.equal(state.key, 'majiidtv')
    assert.equal(state.placard, state.key)
    assert.ok(state.live.includes(state.title), state.live)
    assert.ok(state.live.startsWith('2 / 6'), state.live)
    assert.ok(Math.abs(state.scroll - (await anchorTop(page, 1))) <= 1)
    const next = await frontBox(page)
    await mouseDrag(
      page,
      { x: next.left + next.width / 2, y: next.top + next.height / 2 },
      240,
    )
    await settle(page)
    state = await heroState(page)
    assert.equal(state.key, 'agentmama')
    assert.equal(state.placard, 'agentmama')
    assert.ok(Math.abs(state.scroll - (await anchorTop(page, 0))) <= 1)
    await done(context)
  })

  test('placard, counter and pips switch when the outgoing slab fades out', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    const liveBefore = (await heroState(page)).live
    const box = await frontBox(page)
    const from = { x: box.left + box.width - 60, y: box.top + box.height / 2 }
    const mouse = await timedMouse(page)
    await mouse.down(from)
    const seen = { hidden: 0, shown: 0 }
    for (let i = 1; i <= 26; i += 1) {
      await mouse.move({ x: from.x - i * 7, y: from.y }, 40)
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      )
      const frame = await page.evaluate(() => {
        const outgoing = document.querySelector(
          '.hero-slab[data-key="agentmama"]',
        )
        const style = getComputedStyle(outgoing)
        const placard = document.querySelector('.placard.is-front')
        const dot = document.querySelector('.minimap-dot[aria-current="step"]')
        return {
          opacity: outgoing.classList.contains('is-out')
            ? 0
            : Number(style.opacity),
          placard: placard?.dataset.key ?? null,
          counter:
            document.querySelector('[data-minimap-step]')?.textContent ?? '',
          dot: dot?.dataset.title ?? '',
          title: placard?.querySelector('.placard-title')?.textContent ?? '',
          live: document.querySelector('[data-hero-live]')?.textContent ?? '',
        }
      })
      const label = JSON.stringify(frame)
      if (frame.opacity <= 0.02) {
        seen.hidden += 1
        assert.equal(frame.placard, 'majiidtv', `faded out: ${label}`)
        assert.equal(frame.counter, '2 / 6', label)
      }
      if (frame.opacity >= 0.5) {
        seen.shown += 1
        assert.equal(frame.placard, 'agentmama', `still visible: ${label}`)
        assert.equal(frame.counter, '1 / 6', label)
      }
      assert.equal(frame.dot, frame.title, label)
      assert.equal(frame.live, liveBefore, `announced before commit: ${label}`)
    }
    assert.ok(seen.hidden > 0 && seen.shown > 0, JSON.stringify(seen))
    await mouse.up(400)
    await mouse.detach()
    await settle(page)
    const state = await heroState(page)
    assert.equal(state.placard, state.key)
    await done(context)
  })

  test('a fast flick advances one project and a slow short drag returns', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    let box = await frontBox(page)
    await mouseDrag(
      page,
      { x: box.left + box.width - 60, y: box.top + box.height / 2 },
      -100,
      { moves: 4, gap: 8 },
    )
    await settle(page)
    assert.equal(await frontKey(page), 'majiidtv')
    box = await frontBox(page)
    await mouseDrag(
      page,
      { x: box.left + box.width - 60, y: box.top + box.height / 2 },
      -90,
      { moves: 6, gap: 40, hold: 200 },
    )
    await settle(page)
    assert.equal(await frontKey(page), 'majiidtv')
    const settled = await frontBox(page)
    assert.ok(Math.abs(settled.left - box.left) < 1.5)
    await done(context)
  })

  test('a drag never fires slab or link clicks, a plain click still does', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    await context.route(
      (url) => url.hostname === 'agentmama.ru',
      (route) => route.abort(),
    )
    const popups = []
    context.on('page', (popup) => popups.push(popup))
    const opened = () =>
      page.evaluate(() => {
        const sheet = document.querySelector('[data-sheet]')
        return (
          location.pathname !== '/uz/' ||
          Boolean(sheet && !sheet.hasAttribute('inert'))
        )
      })
    await settle(page)
    const link = await page.locator('.hero-slab.is-front [data-slab-url]')
    const linkBox = await link.boundingBox()
    await mouseDrag(
      page,
      { x: linkBox.x + 10, y: linkBox.y + linkBox.height / 2 },
      120,
      { moves: 8, gap: 16 },
    )
    await settle(page)
    assert.equal(popups.length, 0)
    assert.equal(await frontKey(page), 'agentmama')
    const box = await frontBox(page)
    await mouseDrag(
      page,
      { x: box.left + box.width / 2, y: box.top + box.height / 2 },
      60,
      { moves: 6, gap: 30, hold: 200 },
    )
    await settle(page)
    assert.equal(await opened(), false)
    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: 10000 }),
      link.click(),
    ])
    assert.equal(popups.length, 1)
    await ready(popup)
    await popup.close()
    await page.mouse.click(box.left + box.width / 2, box.top + box.height / 2)
    await page.waitForURL((url) => url.pathname !== '/uz/', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    })
    assert.equal(new URL(page.url()).pathname, '/uz/work/agentmama')
    await done(context)
  })

  test('touch swipes step projects at 390 and vertical gestures keep native scroll', async () => {
    const { context, page } = await open('/uz/', {
      width: 390,
    })
    await settle(page)
    const hall = await page.locator('[data-hall]').boundingBox()
    const y = hall.y + hall.height / 2
    assert.equal(await frontKey(page), 'besttracker')
    await touchDrag(context, page, { x: 320, y }, { x: 90, y })
    await settle(page)
    let state = await heroState(page)
    assert.equal(state.key, 'agentmama')
    assert.equal(state.placard, 'agentmama')
    assert.equal(state.scroll, 0)
    await touchDrag(context, page, { x: 90, y }, { x: 320, y })
    await settle(page)
    assert.equal(await frontKey(page), 'besttracker')
    await touchDrag(context, page, { x: 200, y }, { x: 215, y: y - 260 })
    await settle(page)
    state = await heroState(page)
    assert.ok(state.scroll > 120, `page should scroll, at ${state.scroll}`)
    const dragged = await page.evaluate(() =>
      document.querySelector('[data-hall]').classList.contains('is-dragging'),
    )
    assert.equal(dragged, false)
    const { context: reference, page: plain } = await open('/uz/', {
      width: 390,
    })
    await settle(plain)
    await plain.evaluate((top) => window.scrollTo(0, top), state.scroll)
    await settle(plain)
    assert.equal(state.key, await frontKey(plain))
    await done(reference)
    await done(context)
  })

  test('arrow keys on the focused scene and the prev and next buttons step projects', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    await page.focus('[data-hall]')
    assert.equal(
      await page.evaluate(() =>
        document.querySelector('[data-hall]').matches(':focus-visible'),
      ),
      true,
    )
    await page.keyboard.press('ArrowRight')
    await settle(page)
    assert.equal(await frontKey(page), 'majiidtv')
    await page.keyboard.press('ArrowLeft')
    await settle(page)
    assert.equal(await frontKey(page), 'agentmama')
    const prev = page.locator('[data-hero-step="-1"]')
    const next = page.locator('[data-hero-step="1"]')
    assert.equal(await prev.getAttribute('aria-disabled'), 'true')
    for (const control of [prev, next]) {
      const size = await control.boundingBox()
      assert.ok(size.width >= 44 && size.height >= 44)
    }
    await next.click()
    await settle(page)
    let state = await heroState(page)
    assert.equal(state.key, 'majiidtv')
    assert.equal(state.placard, 'majiidtv')
    assert.equal(await prev.getAttribute('aria-disabled'), null)
    await prev.click()
    await settle(page)
    state = await heroState(page)
    assert.equal(state.key, 'agentmama')
    await page.focus('[data-hall]')
    await page.keyboard.press('End')
    await settle(page)
    assert.equal(await frontKey(page), 'wottank')
    assert.equal(await next.getAttribute('aria-disabled'), 'true')
    await done(context)
  })

  test('a horizontal wheel gesture steps once, vertical wheel scrolls natively', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    const box = await frontBox(page)
    await page.mouse.move(box.left + box.width / 2, box.top + box.height / 2)
    const gesture = (dx, dy) =>
      page.evaluate(
        ([deltaX, deltaY]) => {
          const stage = document.querySelector('[data-hero-stage]')
          for (let i = 0; i < 6; i += 1)
            stage.dispatchEvent(
              new WheelEvent('wheel', {
                deltaX,
                deltaY,
                bubbles: true,
                cancelable: true,
              }),
            )
        },
        [dx, dy],
      )
    await gesture(40, 2)
    await settle(page)
    let state = await heroState(page)
    assert.equal(state.key, 'majiidtv')
    assert.ok(state.live.startsWith('2 / 6'), state.live)
    assert.ok(state.live.includes(state.title), state.live)
    await page.waitForTimeout(400)
    await gesture(40, 0)
    await settle(page)
    state = await heroState(page)
    assert.equal(state.key, 'besttracker')
    assert.ok(state.live.startsWith('3 / 6'), state.live)
    const before = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 320)
    await settle(page)
    assert.ok((await page.evaluate(() => window.scrollY)) > before)
    await done(context)
  })

  test('scroll then swipe and swipe then scroll never jump the camera', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    await scrollToStep(page, 2)
    assert.equal(await frontKey(page), 'besttracker')
    const box = await frontBox(page)
    const swipeJump = await sampleCamera(page, () =>
      mouseDrag(
        page,
        { x: box.left + box.width - 60, y: box.top + box.height / 2 },
        -260,
      ),
    )
    let state = await heroState(page)
    assert.equal(state.key, 'miyolo')
    assert.equal(state.placard, 'miyolo')
    assert.ok(Math.abs(state.scroll - (await anchorTop(page, 3))) <= 1)
    assert.ok(swipeJump < 80, `camera jumped ${swipeJump}px in a frame`)
    const scrollJump = await sampleCamera(page, async () => {
      for (let i = 0; i < 4; i += 1) {
        await page.mouse.wheel(0, 60)
        await page.waitForTimeout(40)
      }
    })
    assert.ok(scrollJump < 80, `camera jumped ${scrollJump}px in a frame`)
    state = await heroState(page)
    assert.equal(state.placard, state.key)
    await done(context)
  })

  test('a slab leaving mid-drag never crosses the copy column', async () => {
    const overlaps = () => {
      const copy = [
        '.hero-name',
        '#intro-title',
        '.hero-lead',
        '.hero .stats',
        '.hero .cta-row',
      ].map((selector) =>
        document.querySelector(selector).getBoundingClientRect(),
      )
      const hits = []
      for (const figure of document.querySelectorAll('.hero-slab')) {
        if (figure.classList.contains('is-out')) continue
        if (Number(getComputedStyle(figure).opacity) < 0.01) continue
        const box = figure.getBoundingClientRect()
        copy.forEach((rect, index) => {
          if (
            box.left < rect.right &&
            box.right > rect.left &&
            box.top < rect.bottom &&
            box.bottom > rect.top
          )
            hits.push(`${figure.dataset.key}@${index}`)
        })
      }
      return hits
    }
    for (const [width, height] of [
      [1280, 800],
      [1024, 768],
      [1440, 900],
    ]) {
      for (const direction of [-1, 1]) {
        const { context, page } = await open('/uz/', { width, height })
        if (direction === 1) {
          await page.focus('[data-hall]')
          await page.keyboard.press('ArrowRight')
          await page.keyboard.press('ArrowRight')
          await settle(page)
        }
        const box = await frontBox(page)
        const start = {
          x: box.left + box.width * 0.6,
          y: box.top + box.height - 30,
        }
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        const found = []
        let samples = 0
        for (let dx = 0; dx <= 700; dx += 35) {
          await page.mouse.move(start.x + direction * dx, start.y)
          await page.evaluate(
            () => new Promise((done) => requestAnimationFrame(() => done())),
          )
          samples += 1
          const hits = await page.evaluate(overlaps)
          if (hits.length) found.push(`${dx}px ${hits.join(',')}`)
        }
        await page.mouse.up()
        await settle(page)
        assert.equal(samples, 21)
        assert.deepEqual(found, [], `${width} drag ${direction}`)
        await done(context)
      }
    }
  })

  test('rapid keys and next clicks land on the committed target and clamp at the ends', async () => {
    const { context, page } = await open('/uz/')
    const order = await page.$$eval('.hero-slab', (figures) =>
      figures.map((figure) => figure.dataset.key),
    )
    await page.focus('[data-hall]')
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(30)
    await page.keyboard.press('ArrowRight')
    await waitFront(page, order[2])
    await settle(page)
    assert.equal(await frontKey(page), order[2])
    const next = page.locator('[data-hero-step="1"]')
    await next.click({ force: true })
    await next.click({ force: true })
    await waitFront(page, order[4])
    await settle(page)
    assert.equal(await frontKey(page), order[4])
    await page.focus('[data-hall]')
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight')
    await waitFront(page, order.at(-1))
    await settle(page)
    assert.equal(await frontKey(page), order.at(-1))
    for (let i = 0; i < 9; i += 1) await page.keyboard.press('ArrowLeft')
    await waitFront(page, order[0])
    await settle(page)
    const state = await heroState(page)
    assert.equal(state.key, order[0])
    assert.equal(state.placard, order[0])
    assert.ok(state.live.startsWith(`1 / ${order.length}`), state.live)
    await done(context)
  })

  test('reduced motion steps instantly on drag and keys', async () => {
    const { context, page } = await open('/uz/', { reduced: true })
    const box = await frontBox(page)
    await mouseDrag(
      page,
      { x: box.left + box.width - 60, y: box.top + box.height / 2 },
      -160,
      { moves: 8, gap: 16 },
    )
    await waitFront(page, 'majiidtv')
    await page.focus('[data-hall]')
    await page.keyboard.press('ArrowRight')
    await waitFront(page, 'besttracker')
    const state = await heroState(page)
    assert.equal(state.key, 'besttracker')
    assert.equal(state.placard, 'besttracker')
    assert.equal(state.scroll, 0)
    await done(context)
  })

  test('the scene has no floor grid on the home page and the showroom', async () => {
    for (const width of [1280, 390]) {
      const { context, page } = await open('/uz/', { width })
      const floors = await page.evaluate(
        () =>
          document.querySelectorAll('.floor, [data-floor], .og-floor').length,
      )
      assert.equal(floors, 0)
      const ground = await page.evaluate(() => {
        const figure = document.querySelector('.hero-slab.is-front')
        const after = getComputedStyle(figure, '::after')
        return {
          image: after.backgroundImage,
          shadow: after.boxShadow,
          color: after.backgroundColor,
          filter: after.filter,
        }
      })
      assert.equal(ground.image, 'none')
      assert.equal(ground.shadow, 'none')
      assert.match(ground.color, /^rgba\(0, 0, 0, 0?\.\d+\)$/)
      assert.match(ground.filter, /^blur\(/)
      const lines = await page.evaluate(
        () =>
          [...document.querySelectorAll('.hero svg path, .hero hr')].filter(
            (element) => !element.closest('.slab, .btn, .icon-btn, .lg, .ic'),
          ).length,
      )
      assert.equal(lines, 0)
      await done(context)
    }
  })
})

describe('home hero breakpoint focus', () => {
  freshBrowser('home hero breakpoint focus')

  const focusState = (page) =>
    page.evaluate(() => {
      const active = document.activeElement
      const front = document.querySelector('.hero-slab.is-front')
      return {
        body: active === document.body,
        hall: active?.matches('[data-hall]') ?? false,
        inFront: Boolean(front?.contains(active)),
        frontPlacard: active?.matches('.placard.is-front') ?? false,
        hidden: Boolean(active?.closest('[aria-hidden="true"]')),
        visible: (active?.getClientRects().length ?? 0) > 0,
        front: front?.dataset.key ?? null,
      }
    })

  test('focus follows the new front when the layout crosses 1024', async () => {
    const scenarios = [
      [1280, 390, 'majiidtv', '.hero-slab.is-front [data-slab-url]'],
      [1280, 390, 'agentmama', '.hero-slab.is-front [data-slab-url]'],
      [1280, 390, 'majiidtv', '.placard.is-front'],
      [390, 1280, 'besttracker', '.placard.is-front'],
      [390, 1280, 'agentmama', '.hero-slab.is-front [data-slab-url]'],
    ]
    for (const [from, to, key, selector] of scenarios) {
      const { context, page } = await open('/uz/', { width: from })
      await settle(page)
      for (
        let step = 0;
        step < 4 && (await frontKey(page)) !== key;
        step += 1
      ) {
        await page.locator('[data-hero-step="1"]').click()
        await page.waitForTimeout(500)
      }
      await waitFront(page, key)
      await settle(page)
      await page.locator(selector).focus()
      const label = `${from} -> ${to} from ${key} ${selector}`
      assert.equal((await focusState(page)).body, false, label)
      await page.setViewportSize({ width: to, height: to < 600 ? 844 : 800 })
      await page.waitForFunction((width) => window.innerWidth === width, to, {
        timeout: 5000,
      })
      await settle(page)
      const state = await focusState(page)
      assert.equal(state.body, false, `${label}: focus fell to body`)
      assert.equal(state.hidden, false, `${label}: focus inside aria-hidden`)
      assert.ok(state.visible, `${label}: focus on an invisible element`)
      assert.ok(
        state.hall || state.inFront || state.frontPlacard,
        `${label}: ${JSON.stringify(state)}`,
      )
      await done(context)
    }
  })
})

describe('home hero swipe edge cases', () => {
  freshBrowser('home hero swipe edge cases')

  const hallBox = (page) =>
    page.evaluate(() => {
      const box = document.querySelector('[data-hall]').getBoundingClientRect()
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      }
    })
  const quietSpot = (page) =>
    page.evaluate(() => {
      const box = document.querySelector('.hero-name').getBoundingClientRect()
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    })
  const blockAgentmama = (context) =>
    context.route(
      (url) => url.hostname === 'agentmama.ru',
      (route) => route.abort(),
    )

  test('a press released outside the hall never leaves a stuck drag', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    const hall = await hallBox(page)
    const box = await frontBox(page)
    const edge = { x: box.left + box.width / 2, y: hall.bottom - 2 }
    const mouse = await timedMouse(page)
    await mouse.down(edge)
    await mouse.move({ x: edge.x + 5, y: hall.bottom + 5 })
    await mouse.move({ x: edge.x + 6, y: hall.bottom + 40 })
    await mouse.up()
    await mouse.detach()
    const before = await frontBox(page)
    for (let i = 1; i <= 12; i += 1)
      await page.mouse.move(edge.x + i * 30, box.top + box.height / 2)
    await settle(page)
    assert.equal(await isDragging(page), false)
    assert.equal(await frontKey(page), 'agentmama')
    const after = await frontBox(page)
    assert.ok(Math.abs(after.left - before.left) < 2)
    await mouseDrag(
      page,
      { x: box.left + box.width - 60, y: box.top + box.height / 2 },
      -240,
    )
    await settle(page)
    assert.equal(await frontKey(page), 'majiidtv')
    await done(context)
  })

  test('a context menu or a lost capture ends the drag without a stuck camera', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    const box = await frontBox(page)
    const from = { x: box.left + 40, y: box.top + box.height / 2 }
    let mouse = await timedMouse(page)
    await mouse.down(from)
    await mouse.move({ x: from.x + 4, y: from.y })
    await page.dispatchEvent('[data-hall]', 'contextmenu')
    await mouse.move(await quietSpot(page))
    await mouse.up()
    await mouse.detach()
    for (let i = 1; i <= 10; i += 1)
      await page.mouse.move(from.x + i * 30, from.y)
    await settle(page)
    assert.equal(await isDragging(page), false)
    assert.equal(await frontKey(page), 'agentmama')
    mouse = await timedMouse(page)
    await mouse.down(from)
    for (let i = 1; i <= 6; i += 1)
      await mouse.move({ x: from.x + i * 12, y: from.y })
    assert.equal(await isDragging(page), true)
    await page.evaluate(() =>
      document.querySelector('[data-hall]').releasePointerCapture(1),
    )
    await mouse.move({ x: from.x + 7 * 12, y: from.y })
    assert.equal(await isDragging(page), false)
    for (let i = 8; i <= 20; i += 1)
      await mouse.move({ x: from.x + i * 12, y: from.y })
    await mouse.move(await quietSpot(page))
    await mouse.up()
    await mouse.detach()
    await settle(page)
    assert.equal(await isDragging(page), false)
    assert.equal(await frontKey(page), 'agentmama')
    await done(context)
  })

  test('pointercancel ends the drag and never swallows a later keyboard Enter', async () => {
    const { context, page } = await open('/uz/')
    await blockAgentmama(context)
    await settle(page)
    const popups = []
    context.on('page', (popup) => popups.push(popup))
    const box = await frontBox(page)
    const from = { x: box.left + 40, y: box.top + box.height / 2 }
    const mouse = await timedMouse(page)
    await mouse.down(from)
    for (let i = 1; i <= 6; i += 1)
      await mouse.move({ x: from.x + i * 10, y: from.y })
    assert.equal(await isDragging(page), true)
    await page.evaluate(() =>
      document.querySelector('[data-hall]').dispatchEvent(
        new PointerEvent('pointercancel', {
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          bubbles: true,
        }),
      ),
    )
    assert.equal(await isDragging(page), false)
    await mouse.move(await quietSpot(page))
    await mouse.up()
    await mouse.detach()
    await settle(page)
    assert.equal(await frontKey(page), 'agentmama')
    await page.focus('.hero-slab.is-front [data-slab-url]')
    await page.keyboard.press('Enter')
    await page.waitForEvent('popup', { timeout: 5000 }).catch((error) => {
      assert.fail(`Enter on the front link was swallowed: ${error.message}`)
    })
    assert.equal(popups.length, 1)
    await done(context)
  })

  test('right and middle buttons and a second finger never drag', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    const box = await frontBox(page)
    for (const button of ['right', 'middle']) {
      await mouseDrag(
        page,
        { x: box.left + 40, y: box.top + box.height / 2 },
        260,
        { button },
      )
      assert.equal(await isDragging(page), false)
      await settle(page)
      assert.equal(await frontKey(page), 'agentmama', `${button} button`)
    }
    await done(context)
    const phone = await open('/uz/', { width: 390 })
    await settle(phone.page)
    const hall = await phone.page.locator('[data-hall]').boundingBox()
    const y = hall.y + hall.height / 2
    assert.equal(await frontKey(phone.page), 'besttracker')
    const session = await phone.context.newCDPSession(phone.page)
    const anchor = { x: 60, y, id: 1 }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [anchor],
    })
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [anchor, { x: 330, y, id: 2 }],
    })
    for (let i = 1; i <= 12; i += 1)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [anchor, { x: 330 - i * 20, y, id: 2 }],
      })
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    await session.detach()
    await settle(phone.page)
    assert.equal(await frontKey(phone.page), 'besttracker')
    assert.equal(await isDragging(phone.page), false)
    await done(phone.context)
  })

  test('catching the camera mid-settle holds it and drags from there without a click', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    const box = await frontBox(page)
    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    const incoming = await page.evaluate(
      () =>
        document.querySelector('.hero-slab[data-d="1"]').getBoundingClientRect()
          .left,
    )
    await page.focus('[data-hall]')
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(
      (left) =>
        Math.abs(
          document
            .querySelector('.hero-slab[data-d="1"]')
            .getBoundingClientRect().left - left,
        ) > 20,
      incoming,
      { polling: 'raf', timeout: 5000 },
    )
    await mouseDrag(page, centre, 340)
    await settle(page)
    const state = await heroState(page)
    assert.equal(state.key, 'agentmama')
    assert.equal(state.scroll, await anchorTop(page, 0))
    assert.equal(
      await page.evaluate(() => location.pathname),
      '/uz/',
      'A caught drag must not open the slab',
    )
    await done(context)
  })

  test('the rubber band stops at half a project past the first slab', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    const from = { x: 120, y: 240 }
    assert.equal(
      await page.evaluate(
        ({ x, y }) =>
          Boolean(document.elementFromPoint(x, y)?.closest('[data-hall]')),
        from,
      ),
      true,
    )
    const pull = async (dx) => {
      const mouse = await timedMouse(page)
      await mouse.down(from)
      for (let i = 1; i <= 20; i += 1)
        await mouse.move({ x: from.x + (dx * i) / 20, y: from.y })
      await page.waitForFunction(() => true, null, { polling: 'raf' })
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => done())),
      )
      const held = await page.evaluate(
        () =>
          new DOMMatrix(
            document.querySelector('.hero-slab[data-d="0"]').style.transform,
          ),
      )
      await mouse.up(300)
      await mouse.detach()
      await settle(page)
      return held.m41
    }
    const rest = await page.evaluate(
      () =>
        new DOMMatrix(
          document.querySelector('.hero-slab[data-d="0"]').style.transform,
        ).m41,
    )
    const far = await pull(900)
    const further = await pull(1100)
    assert.ok(Math.abs(far - rest) > 20, `band should move, ${far} vs ${rest}`)
    assert.ok(
      Math.abs(far - further) < 1,
      `band must saturate: ${far} vs ${further}`,
    )
    const state = await heroState(page)
    assert.equal(state.key, 'agentmama')
    assert.equal(state.scroll, await anchorTop(page, 0))
    await done(context)
  })

  test('arrow keys with focus on the front link keep focus in the scene and announce', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    await page.focus('.hero-slab.is-front [data-slab-url]')
    await page.keyboard.press('ArrowRight')
    await settle(page)
    const focus = await page.evaluate(() => {
      const active = document.activeElement
      return {
        body: active === document.body,
        inFront: Boolean(active.closest('.hero-slab.is-front')),
        link: active.matches('[data-slab-url]'),
        hidden: Boolean(active.closest('[aria-hidden="true"]')),
        tabindex: active.getAttribute('tabindex'),
      }
    })
    assert.deepEqual(focus, {
      body: false,
      inFront: true,
      link: true,
      hidden: false,
      tabindex: null,
    })
    const state = await heroState(page)
    assert.equal(state.key, 'majiidtv')
    assert.ok(state.live.startsWith('2 / 6'), state.live)
    assert.ok(state.live.includes(state.title), state.live)
    await page.keyboard.press('ArrowRight')
    await settle(page)
    assert.deepEqual(
      await page.evaluate(() => ({
        key: document.querySelector('.hero-slab.is-front').dataset.key,
        hall: document.activeElement.matches('[data-hall]'),
        body: document.activeElement === document.body,
      })),
      { key: 'besttracker', hall: true, body: false },
      'a phone front has no link, focus falls back to the hall',
    )
    assert.ok((await heroState(page)).live.startsWith('3 / 6'))
    await done(context)
  })

  test('prev and next look disabled at the ends', async () => {
    const { context, page } = await open('/uz/')
    await settle(page)
    const look = () =>
      page.evaluate(() =>
        ['-1', '1'].map((step) => {
          const button = document.querySelector(`[data-hero-step="${step}"]`)
          return [
            button.getAttribute('aria-disabled'),
            getComputedStyle(button).opacity,
          ]
        }),
      )
    assert.deepEqual(await look(), [
      ['true', '0.4'],
      [null, '1'],
    ])
    await page.focus('[data-hall]')
    await page.keyboard.press('End')
    await settle(page)
    assert.deepEqual(await look(), [
      [null, '1'],
      ['true', '0.4'],
    ])
    await page.click('[data-hero-step="1"]', { force: true })
    await settle(page)
    assert.equal(await frontKey(page), 'wottank')
    await done(context)
  })
})

describe('home showroom', () => {
  freshBrowser('home showroom')

  test('the nav contact button goes quiet while the stage project button is in view', async () => {
    const { context, page } = await open('/uz/')
    const accent = () =>
      page.evaluate(() =>
        document
          .querySelector('[data-nav-cta]')
          .classList.contains('is-accent'),
      )
    await page.evaluate(() => document.querySelector('#about').scrollIntoView())
    await page.waitForTimeout(600)
    assert.equal(await accent(), true)
    await page.evaluate(() =>
      document
        .querySelector('#work [data-info-links] .sr-open')
        .scrollIntoView({ block: 'center' }),
    )
    await page.waitForTimeout(600)
    assert.equal(await accent(), false)
    await page.click('#work [data-step="1"]')
    await page.waitForTimeout(600)
    assert.equal(await accent(), false)
    await done(context)
  })
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
    await done(context)
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
    await done(context)
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
    await done(context)
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
    await done(context)
  })
})

const caseScreens = Object.fromEntries(
  JSON.parse(
    readFileSync(new URL('../content/cases.json', import.meta.url), 'utf8'),
  ).cases.map((item) => [item.key, item.screens ?? []]),
)

const stageFront = (page) =>
  page.evaluate(() => {
    const world = document.querySelector('#work [data-stage-world]')
    const figure = world.querySelector('.sr-slab[data-slot="0"]')
    const neighbours = [
      ...world.querySelectorAll('.sr-slab:not([data-slot="0"])'),
    ].map((element) => Number(getComputedStyle(element).opacity))
    return {
      key: figure.dataset.key,
      trio: figure.classList.contains('slab-trio'),
      hasTrio: world.classList.contains('has-trio'),
      hasPhone: world.classList.contains('has-phone'),
      sources: [...figure.querySelectorAll('img')].map((image) =>
        new URL(image.currentSrc || image.src).pathname.split('/').pop(),
      ),
      sides: [...figure.querySelectorAll('.trio-side')].map((element) =>
        Number(getComputedStyle(element).opacity),
      ),
      neighbours,
      width: figure.getBoundingClientRect().width,
      centre: (() => {
        const box = figure.getBoundingClientRect()
        return Math.round(box.left + box.width / 2)
      })(),
      stageCentre: (() => {
        const box = world.closest('[data-stage]').getBoundingClientRect()
        return Math.round(box.left + box.width / 2)
      })(),
    }
  })

const ownScreens = (key, sources) =>
  sources.length === caseScreens[key].length &&
  caseScreens[key].every((screen) =>
    sources.some((source) => source.startsWith(`${screen}-`)),
  )

describe('mobile project trios', () => {
  freshBrowser('mobile project trios')

  test('the work stage shows three own screens for a mobile app and one slab for web', async () => {
    const { context, page } = await open('/uz/work/')
    let front = await stageFront(page)
    assert.equal(front.key, 'agentmama')
    assert.equal(front.trio, false)
    assert.equal(front.sources.length, 1)
    await page.click('.sr-item[data-key="wegotrip"] [data-row]')
    await stageSettle(page)
    front = await stageFront(page)
    assert.equal(front.key, 'wegotrip')
    assert.equal(front.trio, true)
    assert.equal(front.hasTrio, true)
    assert.ok(ownScreens('wegotrip', front.sources), front.sources.join())
    assert.deepEqual(front.sides, [1, 1])
    assert.ok(front.neighbours.every((value) => value === 0))
    assert.ok(front.width >= 150, `centre phone is ${front.width}px wide`)
    await page.click('.sr-item[data-key="payqr"] [data-row]')
    await stageSettle(page)
    front = await stageFront(page)
    assert.equal(front.sources.length, 2)
    assert.ok(ownScreens('payqr', front.sources))
    assert.ok(front.neighbours.every((value) => value === 0))
    await page.click('.sr-item[data-key="yolo"] [data-row]')
    await stageSettle(page)
    front = await stageFront(page)
    assert.equal(front.trio, false)
    assert.equal(front.hasTrio, false)
    assert.ok(ownScreens('yolo', front.sources))
    await done(context)
  })

  test('a single-screen mobile front shows no other project beside it', async () => {
    for (const width of [1280, 1024]) {
      const { context, page } = await open('/uz/work/', { width })
      for (const key of ['geoblinker', 'yolo', 'mynails']) {
        await page.click(`.sr-item[data-key="${key}"] [data-row]`)
        await waitStage(page, key)
        await stageSettle(page)
        const front = await stageFront(page)
        assert.equal(front.trio, false, key)
        assert.equal(front.hasPhone, true, key)
        assert.ok(ownScreens(key, front.sources), key)
        assert.ok(front.neighbours.length > 0, key)
        assert.deepEqual(
          front.neighbours.filter((value) => value > 0),
          [],
          `${key} at ${width}`,
        )
        assert.ok(
          Math.abs(front.centre - front.stageCentre) <= 2,
          `${key} at ${width}: ${front.centre} vs ${front.stageCentre}`,
        )
      }
      await page.click('.sr-item[data-key="mynails"] [data-row]')
      await waitStage(page, 'mynails')
      await page.click('#work [data-step="1"]')
      await waitStage(page, 'altn')
      await stageSettle(page)
      let front = await stageFront(page)
      assert.equal(front.hasPhone, true)
      assert.deepEqual(
        front.neighbours.filter((value) => value > 0),
        [],
      )
      await page.click('.sr-item[data-key="matik"] [data-row]')
      await waitStage(page, 'matik')
      await stageSettle(page)
      front = await stageFront(page)
      assert.equal(front.hasPhone, false)
      assert.ok(front.neighbours.some((value) => value > 0))
      await done(context)
    }
  })

  test('filter chips, arrows and keys walk every mobile app with its own screens', async () => {
    const { context, page } = await open('/uz/work/')
    const mobileOrder = await page.$$eval('#work .sr-item', (items) =>
      items
        .filter((item) => item.dataset.category.split(' ').includes('mobile'))
        .map((item) => item.dataset.key),
    )
    assert.equal(mobileOrder.length, 12)
    await page.click('[data-filter="mobile"]')
    await page.mouse.move(1270, 4)
    await waitStage(page, mobileOrder[0])
    await stageSettle(page)
    const seen = new Set()
    for (let i = 0; i < 12; i += 1) {
      const front = await stageFront(page)
      assert.equal(front.key, mobileOrder[i])
      assert.ok(
        ownScreens(front.key, front.sources),
        `${front.key}: ${front.sources.join()}`,
      )
      assert.equal(front.trio, caseScreens[front.key].length > 1)
      seen.add(front.key)
      if (i % 2) await page.click('#work [data-step="1"]')
      else {
        await page.focus('#work [data-step="1"]')
        await page.keyboard.press('ArrowRight')
      }
      if (i < 11) await waitStage(page, mobileOrder[i + 1])
      await stageSettle(page)
    }
    assert.equal(seen.size, 12)
    await page.click('[data-filter="web"]')
    await page.waitForFunction(
      () =>
        document.querySelector('#work .sr-slab[data-slot="0"]')?.dataset
          .kind === 'browser',
      null,
      { timeout: 5000 },
    )
    await stageSettle(page)
    const web = await stageFront(page)
    assert.equal(web.trio, false)
    assert.equal(web.hasTrio, false)
    await done(context)
  })

  test('trios fit at 390 without horizontal overflow on home and case pages', async () => {
    for (const path of ['/uz/', '/uz/work/okh/', '/uz/work/besttracker/']) {
      const { context, page } = await open(path, { width: 390 })
      if (path === '/uz/') {
        await page.click('.sr-item[data-key="okh"] [data-row]')
        await stageSettle(page)
      }
      const state = await page.evaluate(() => {
        const figure =
          document.querySelector('#work .sr-slab[data-slot="0"]') ??
          document.querySelector('.case-slab')
        const phones = [...figure.querySelectorAll('.trio-phone')].map(
          (phone) => phone.getBoundingClientRect(),
        )
        return {
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          count: phones.length,
          left: Math.min(...phones.map((box) => box.left)),
          right: Math.max(...phones.map((box) => box.right)),
          centre: figure.querySelector('.trio-centre').getBoundingClientRect()
            .width,
        }
      })
      assert.equal(state.overflow, 0, path)
      assert.ok(state.count >= 2, path)
      assert.ok(state.left >= 0 && state.right <= 390, path)
      assert.ok(state.centre >= 120, `${path} centre ${state.centre}`)
      await done(context)
    }
  })

  const trioState = (page) =>
    page.evaluate(() => {
      const figure = document.querySelector('.case-slab')
      return {
        screens: figure.dataset.screens,
        phones: [...figure.querySelectorAll('.trio-phone')].map((phone) => ({
          role: phone.className,
          failed: phone
            .querySelector('[data-screen]')
            .classList.contains('is-failed'),
          shown: getComputedStyle(phone).display !== 'none',
          fallback: getComputedStyle(phone.querySelector('.slab-fallback'))
            .display,
          height: phone.offsetHeight,
          box: phone.getBoundingClientRect().toJSON(),
        })),
      }
    })

  test('a failed flank screen drops that phone and the trio reflows to two', async () => {
    const { context, page } = await open('/uz/work/okh/', {
      block: /okh-route-/,
    })
    await page.waitForFunction(
      () => document.querySelector('.case-slab')?.dataset.screens === '2',
      null,
      { timeout: 10000 },
    )
    const state = await trioState(page)
    const failed = state.phones.filter((phone) => phone.failed)
    assert.equal(failed.length, 1)
    assert.match(failed[0].role, /trio-left/)
    assert.match(failed[0].role, /is-dropped/)
    assert.equal(failed[0].shown, false)
    const shown = state.phones.filter((phone) => phone.shown)
    assert.equal(shown.length, 2)
    assert.ok(shown.every((phone) => !phone.failed))
    assert.ok(
      shown.every((phone) => Math.abs(phone.height - shown[0].height) < 1),
      JSON.stringify(shown),
    )
    const [centre, side] = [
      shown.find((phone) => phone.role.includes('trio-centre')),
      shown.find((phone) => phone.role.includes('trio-right')),
    ]
    assert.ok(centre && side, JSON.stringify(shown))
    assert.ok(side.box.left < centre.box.right, 'the right flank tucks in')
    await done(context)
  })

  test('a failed centre screen promotes a flank to the centre and reflows to two', async () => {
    const { context, page } = await open('/uz/work/okh/', {
      block: /okh-phone-/,
    })
    await page.waitForFunction(
      () => document.querySelector('.case-slab')?.dataset.screens === '2',
      null,
      { timeout: 10000 },
    )
    await page.waitForFunction(
      () =>
        document.querySelector('.case-slab .trio-centre img')?.naturalWidth > 0,
      null,
      { timeout: 10000 },
    )
    const state = await trioState(page)
    const shown = state.phones.filter((phone) => phone.shown)
    assert.equal(shown.length, 2)
    assert.ok(
      shown.every((phone) => !phone.failed && phone.fallback === 'none'),
    )
    const centre = shown.find((phone) => phone.role.includes('trio-centre'))
    assert.ok(centre, JSON.stringify(shown))
    const sources = await page.$$eval(
      '.case-slab .trio-phone:not(.is-dropped) img',
      (images) =>
        images.map((image) =>
          new URL(image.currentSrc || image.src).pathname.split('/').pop(),
        ),
    )
    assert.equal(sources.length, 2)
    assert.ok(sources.every((source) => !source.startsWith('okh-phone-')))
    const centreSource = await page.$eval(
      '.case-slab .trio-centre img',
      (image) =>
        new URL(image.currentSrc || image.src).pathname.split('/').pop(),
    )
    assert.ok(centreSource.startsWith('okh-route-'), centreSource)
    const dropped = state.phones.filter((phone) => !phone.shown)
    assert.equal(dropped.length, 1)
    assert.ok(dropped[0].failed)
    await done(context)
  })

  test('the typographic slab shows only when every trio screen fails', async () => {
    const { context, page } = await open('/uz/work/okh/', {
      block: /okh-(phone|route|info)-/,
    })
    await page.waitForFunction(
      () => document.querySelector('.case-slab')?.dataset.screens === '1',
      null,
      { timeout: 10000 },
    )
    const state = await trioState(page)
    const shown = state.phones.filter((phone) => phone.shown)
    assert.equal(shown.length, 1)
    assert.match(shown[0].role, /trio-centre/)
    assert.equal(shown[0].fallback, 'flex')
    assert.equal(state.phones.filter((phone) => phone.failed).length, 3)
    await done(context)
  })

  test('the hero front mobile app shows its trio and fades the neighbours', async () => {
    const { context, page } = await open('/uz/', { width: 390, settle: 1400 })
    const state = await page.evaluate(() => {
      const figure = document.querySelector('.hero-slab.is-front')
      return {
        key: figure.dataset.key,
        sources: [...figure.querySelectorAll('img')].map((image) =>
          new URL(image.currentSrc || image.src).pathname.split('/').pop(),
        ),
        others: [
          ...document.querySelectorAll(
            '.hero-slab:not(.is-front):not(.is-out)',
          ),
        ]
          .filter((element) => Number(getComputedStyle(element).opacity) > 0.05)
          .map((element) => element.dataset.m),
      }
    })
    assert.equal(state.key, 'besttracker')
    assert.ok(ownScreens('besttracker', state.sources))
    assert.deepEqual(state.others, ['1'])
    await done(context)
  })

  test('the next slab peeks at the right edge above the fold at 390', async () => {
    const { context, page } = await open('/uz/', { width: 390, height: 844 })
    await settle(page)
    const peek = await page.evaluate(() => {
      const hall = document.querySelector('[data-hall]').getBoundingClientRect()
      const next = document
        .querySelector('.hero-slab[data-m="1"]')
        .getBoundingClientRect()
      const front = document
        .querySelector('.hero-slab.is-front')
        .getBoundingClientRect()
      return {
        share: (hall.right - next.left) / next.width,
        top: next.top,
        bottom: Math.min(next.bottom, hall.bottom),
        clear: next.left - front.right,
        opacity: Number(
          getComputedStyle(document.querySelector('.hero-slab[data-m="1"]'))
            .opacity,
        ),
      }
    })
    assert.ok(
      peek.share >= 0.12 && peek.share <= 0.16,
      `peek share ${peek.share}`,
    )
    assert.ok(peek.bottom <= 780, `peek ends at ${peek.bottom}`)
    assert.ok(peek.top >= 0)
    assert.ok(peek.opacity > 0.3, `peek opacity ${peek.opacity}`)
    await done(context)
  })

  test('counter, pips and prev and next sit in the placard row', async () => {
    for (const width of [390, 1280]) {
      const { context, page } = await open('/uz/', { width })
      await settle(page)
      const row = await page.evaluate(() => {
        const box = (selector) =>
          document.querySelector(selector).getBoundingClientRect().toJSON()
        return {
          minimap: box('[data-minimap]'),
          placard: box('.placard.is-front'),
          title: box('.placard.is-front .placard-title'),
          dock: box('.hero-dock'),
          height: window.innerHeight,
          tabs: [...document.querySelectorAll('.minimap-dot')].filter(
            (dot) => dot.tabIndex === 0,
          ).length,
        }
      })
      const gap = row.placard.top - row.minimap.bottom
      assert.ok(
        gap >= 0 && gap <= 16,
        `controls are ${gap}px above the placard at ${width}`,
      )
      assert.ok(row.minimap.bottom <= row.height, `controls fold at ${width}`)
      assert.ok(
        row.title.bottom <= row.height,
        `placard title below the fold at ${width}`,
      )
      assert.ok(row.placard.bottom <= row.dock.bottom + 0.5)
      assert.equal(row.tabs, 1, `one pip tab stop at ${width}`)
      await done(context)
    }
  })

  test('the resting front slab stays inside the 40 px gutter on desktop', async () => {
    for (const width of [1024, 1280, 1440]) {
      const { context, page } = await open('/uz/', { width, height: 800 })
      await settle(page)
      for (let step = 0; step < 6; step += 1) {
        await scrollToStep(page, step)
        const box = await page.evaluate(() => {
          const figure = document.querySelector('.hero-slab.is-front')
          const boxes = [figure, ...figure.querySelectorAll('.trio-phone')]
            .filter((element) => getComputedStyle(element).display !== 'none')
            .map((element) => element.getBoundingClientRect())
          const copy = document
            .querySelector('.hero-copy')
            .getBoundingClientRect()
          return {
            left: Math.min(...boxes.map((rect) => rect.left)),
            right: Math.max(...boxes.map((rect) => rect.right)),
            copy: copy.right,
          }
        })
        const key = await frontKey(page)
        assert.ok(
          box.right <= width - 40 + 0.5,
          `${key} at ${width}: right edge ${box.right}`,
        )
        assert.ok(box.left >= box.copy, `${key} at ${width}: under the copy`)
        assert.ok(
          box.right - box.left >= 240,
          `${key} at ${width}: width ${box.right - box.left}`,
        )
      }
      await done(context)
    }
  })
})

describe('work index', () => {
  freshBrowser('work index')

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
    await done(context)
  })

  test('a malformed hash does not break the page', async () => {
    const { context, page } = await open('/uz/work/#%E0', { width: 1280 })
    await page.click('[data-step="1"]')
    await page.waitForTimeout(400)
    assert.equal(await currentRow(page, '[data-showroom]'), 'majiidtv')
    await done(context)
  })
})

describe('slab shadows', () => {
  freshBrowser('slab shadows')

  test('slab shadows fade into the light canvas with no clipped edge', async () => {
    const cases = [
      ['/uz/', 1280, '.hero-slab.is-front', '[data-hall]', null],
      ['/uz/', 390, '.hero-slab.is-front', '[data-hall]', null],
      [
        '/uz/work/',
        1280,
        '#work .sr-slab[data-slot="0"]',
        '#work [data-stage]',
        'payqr',
      ],
      [
        '/uz/work/',
        1280,
        '#work .sr-slab[data-slot="0"]',
        '#work [data-stage]',
        'agentmama',
      ],
      [
        '/uz/',
        390,
        '[data-showroom] .sr-slab[data-slot="0"]',
        '[data-showroom] [data-stage]',
        'showroom',
      ],
    ]
    for (const [path, width, front, container, target] of cases) {
      const { context, page } = await open(path, { width, theme: 'light' })
      if (target === 'showroom') {
        await page.locator(container).scrollIntoViewIfNeeded()
        await page.evaluate(() => window.scrollBy(0, -120))
        await page.waitForTimeout(400)
      } else if (target) {
        if ((await stageKey(page)) !== target)
          await page.click(`.sr-item[data-key="${target}"] [data-row]`)
        await waitStage(page, target)
        await page.evaluate(
          (selector) =>
            document
              .querySelector(selector)
              .scrollIntoView({ block: 'center', behavior: 'instant' }),
          container,
        )
        await stageSettle(page)
      } else await settle(page)
      const steps = await shadowSteps(page, front, container)
      assert.ok(steps.length >= 2, `${path} ${width}: ${JSON.stringify(steps)}`)
      for (const strip of steps)
        assert.ok(
          strip.step <= 6,
          `${path} ${width} ${target ?? 'hero'}: ${strip.axis} step ${strip.step} at ${JSON.stringify(strip)}`,
        )
      await done(context)
    }
  })
})

describe('site chrome', () => {
  freshBrowser('site chrome')

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
    await done(context)
  })

  test('theme colour, accent and placard tile follow the active theme', async () => {
    const { context, page } = await open('/uz/')
    const look = () =>
      page.evaluate(() => {
        const pick = (selector) => document.querySelector(selector)
        const style = (selector) => getComputedStyle(pick(selector))
        const tile = style('.placard-num')
        return {
          meta: pick('meta[name="theme-color"]').getAttribute('content'),
          canvas: getComputedStyle(document.body).backgroundColor,
          tile: [tile.backgroundColor, tile.color],
          primary: style('.btn-primary').backgroundColor,
          dim: getComputedStyle(pick('.slab-dim')).backgroundColor,
        }
      })
    const dark = await look()
    assert.equal(dark.meta, '#0b0c0e')
    assert.equal(dark.canvas, 'rgb(11, 12, 14)')
    assert.deepEqual(dark.tile, ['rgb(11, 12, 14)', 'rgb(181, 242, 61)'])
    assert.equal(dark.primary, 'rgb(181, 242, 61)')
    assert.equal(dark.dim, 'rgb(11, 12, 14)')
    await page.click('[data-theme-toggle]')
    await page.waitForTimeout(400)
    const light = await look()
    assert.equal(light.meta, '#ecedef')
    assert.equal(light.canvas, 'rgb(236, 237, 239)')
    assert.deepEqual(light.tile, ['rgb(11, 12, 14)', 'rgb(181, 242, 61)'])
    assert.equal(light.primary, 'rgb(11, 12, 14)')
    assert.equal(light.dim, 'rgb(236, 237, 239)')
    await page.reload({ waitUntil: 'domcontentloaded' })
    assert.equal(
      await page.evaluate(() =>
        document
          .querySelector('meta[name="theme-color"]')
          .getAttribute('content'),
      ),
      '#ecedef',
    )
    await done(context)
    const plain = await browser.newContext({ javaScriptEnabled: false })
    const noScript = await plain.newPage()
    await noScript.goto(`${origin}/uz/`, { waitUntil: 'domcontentloaded' })
    assert.equal(
      await noScript
        .locator('meta[name="theme-color"]')
        .getAttribute('content'),
      '#0b0c0e',
    )
    await done(plain)
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
    await done(context)
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
        await done(context)
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
      await done(context)
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
      await done(context)
    }
  })

  test('no console errors or warnings were logged', () => {
    assert.deepEqual(consoleIssues, [])
  })
})
