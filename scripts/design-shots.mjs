import { mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeBrowser, getBrowser, startServer } from '../tests/harness.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, '.screenshots/redesign')

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
]

const server = await startServer()
const browser = await getBrowser()
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

for (const theme of ['dark', 'light']) {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      colorScheme: theme,
    })
    const page = await context.newPage()
    await page.addInitScript((value) => {
      window.localStorage.setItem('portfolio-anna-theme', value)
      window.localStorage.setItem('portfolio-anna-lang', 'ru')
    }, theme)
    await page.goto(server.origin, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    const total = await page.evaluate(() => document.body.scrollHeight)
    const frames = Math.min(6, Math.ceil(total / viewport.height))
    for (let i = 0; i < frames; i += 1) {
      await page.evaluate((y) => window.scrollTo(0, y), i * viewport.height)
      await page.waitForTimeout(650)
      await page.screenshot({
        path: `${out}/${theme}-${viewport.name}-${i + 1}.png`,
      })
    }
    await context.close()
  }
}

for (const theme of ['dark', 'light']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  })
  const page = await context.newPage()
  await page.addInitScript((value) => {
    window.localStorage.setItem('portfolio-anna-theme', value)
    window.localStorage.setItem('portfolio-anna-lang', 'ru')
  }, theme)
  await page.goto(server.origin, { waitUntil: 'domcontentloaded' })
  await page.click('#workGrid .work-row:first-child .work-sat-face')
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/${theme}-case-open.png` })
  await context.close()
}

for (const [theme, width, height] of [
  ['light', 390, 844],
  ['dark', 390, 844],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: theme,
  })
  const page = await context.newPage()
  await page.addInitScript((value) => {
    window.localStorage.setItem('portfolio-anna-theme', value)
    window.localStorage.setItem('portfolio-anna-lang', 'ru')
  }, theme)
  await page.goto(`${server.origin}/#contact`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/${theme}-mobile-contact.png` })
  await context.close()
}

const menuContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
})
const menuPage = await menuContext.newPage()
await menuPage.goto(server.origin, { waitUntil: 'domcontentloaded' })
await menuPage.click('.nav-toggle')
await menuPage.waitForTimeout(500)
await menuPage.screenshot({ path: `${out}/dark-mobile-menu.png` })
await menuContext.close()

await closeBrowser()
await server.close()
console.log(`shots: ${out}`)
