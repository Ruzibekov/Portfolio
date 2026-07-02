const path = require('path')
const fs = require('fs')
const {
  chromium,
} = require('/Users/ruzibekov/.claude-state/supabase-debug/node_modules/playwright')

const BASE = 'http://localhost:8848'
const OUT = path.join(__dirname, '..', '.screenshots', 'redesign')

const viewports = [
  {
    name: 'mobile-375',
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'mobile-360',
    width: 360,
    height: 640,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'tablet-768',
    width: 768,
    height: 1024,
    isMobile: true,
    hasTouch: true,
  },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1512', width: 1512, height: 950 },
]

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const errors = []

  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.hasTouch,
      deviceScaleFactor: vp.isMobile ? 2 : 1,
      reducedMotion: 'no-preference',
    })
    const page = await ctx.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${vp.name}] console: ${m.text()}`)
    })
    page.on('pageerror', (e) =>
      errors.push(`[${vp.name}] pageerror: ${e.message}`),
    )
    page.on('requestfailed', (r) =>
      errors.push(`[${vp.name}] reqfail: ${r.url()}`),
    )

    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto'
      document
        .querySelectorAll('.reveal')
        .forEach((el) => el.classList.add('is-visible'))
      document
        .querySelectorAll('.work-row')
        .forEach((el) => el.classList.add('is-shown'))
    })
    await page.evaluate(async () => {
      document
        .querySelectorAll('img[loading="lazy"]')
        .forEach((img) => (img.loading = 'eager'))
      await Promise.all(
        [...document.images].map((img) => img.decode().catch(() => {})),
      )
    })
    await page.waitForTimeout(700)
    await page.screenshot({
      path: `${OUT}/${vp.name}-full.png`,
      fullPage: true,
    })

    // Expanded first work row
    await page.locator('.work-row summary').first().click()
    await page.waitForTimeout(600)
    await page.locator('#work').scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${OUT}/${vp.name}-row-open.png` })
    const openHeight = await page
      .locator('.work-row details[open] .row-expand-inner')
      .first()
      .evaluate((el) => el.getBoundingClientRect().height)

    // Filter: web
    await page.locator('[data-filter="web"]').click()
    await page.waitForTimeout(300)
    const visibleRows = await page.evaluate(
      () => document.querySelectorAll('.work-row:not(.is-hidden)').length,
    )
    await page.screenshot({ path: `${OUT}/${vp.name}-filter-web.png` })
    await page.locator('[data-filter="all"]').click()

    // Mobile nav
    if (vp.width < 1081) {
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.locator('.nav-toggle').click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${OUT}/${vp.name}-menu.png` })
      await page.keyboard.press('Escape')
    }

    const overflow = await page.evaluate(() => {
      const bad = []
      const docW = document.documentElement.clientWidth
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width && (r.right > docW + 1 || r.left < -1)) {
          const cs = getComputedStyle(el)
          if (cs.position === 'fixed') return
          if (el.closest('.ticker')) return
          bad.push(
            `${el.tagName}.${(el.className || '').toString().slice(0, 40)} right=${Math.round(r.right)} left=${Math.round(r.left)} docW=${docW}`,
          )
        }
      })
      return bad.slice(0, 12)
    })
    console.log(
      `${vp.name}: rows(web)=${visibleRows} openExpandH=${Math.round(openHeight)} overflow=${overflow.length ? JSON.stringify(overflow, null, 1) : 'none'}`,
    )
    await ctx.close()
  }

  console.log(
    errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors',
  )
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
