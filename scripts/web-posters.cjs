const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const {
  chromium,
} = require('/Users/ruzibekov/.claude-state/supabase-debug/node_modules/playwright')

const RAW = '/tmp/web-poster-raw'
const OUT = path.join(__dirname, '..', 'screenshots')

const SITES = [
  {
    name: 'tildon',
    main: { url: 'https://tildon.vercel.app', wait: 4000 },
    side: { url: 'https://tildon.vercel.app', wait: 4000, scrollY: 950 },
    label: 'tildon.vercel.app',
  },
  {
    name: 'vfx',
    layout: 'single',
    main: { url: 'https://vfx-timecode.vercel.app', wait: 3000 },
    label: 'vfx-timecode.vercel.app',
  },
  {
    name: 'ailogoedit',
    main: { url: 'https://ailogoedit.com', wait: 4000, accept: true },
    side: {
      url: 'https://ailogoedit.com',
      wait: 4000,
      accept: true,
      scrollY: 1500,
    },
    label: 'ailogoedit.com',
  },
  {
    name: 'pixelvault',
    main: { url: 'https://pixelvault.vercel.app', wait: 4000 },
    side: { url: 'https://pixelvault.vercel.app', wait: 4000, scrollY: 950 },
    label: 'pixelvault.vercel.app',
  },
]

const posterHtml = (name, label, layout) => `<!doctype html>
<html><head><style>
  * { margin: 0; box-sizing: border-box; }
  .poster {
    position: relative;
    width: 1400px;
    height: 933px;
    overflow: hidden;
    background:
      radial-gradient(120% 90% at 80% -10%, rgba(63,221,130,0.10), transparent 60%),
      radial-gradient(90% 70% at 0% 105%, rgba(63,221,130,0.06), transparent 55%),
      linear-gradient(rgba(233,242,230,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(233,242,230,0.05) 1px, transparent 1px),
      #0e1b12;
    background-size: auto, auto, 88px 88px, 88px 88px, auto;
    font-family: 'SF Mono', Menlo, monospace;
  }
  .win {
    position: absolute;
    overflow: hidden;
    border: 1px solid rgba(233,242,230,0.16);
    border-radius: 8px;
    background: #070c09;
    box-shadow: 0 24px 70px rgba(0,0,0,0.6);
  }
  .win.main { top: 64px; left: 70px; width: 960px; }
  .win.side { top: 214px; left: 830px; width: 500px; }
  .poster.single .win.main { top: 70px; left: 115px; width: 1170px; }
  .bar {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 40px;
    padding: 0 14px;
    border-bottom: 1px solid rgba(233,242,230,0.1);
    background: #13221a;
  }
  .bar i { width: 9px; height: 9px; border-radius: 50%; background: rgba(233,242,230,0.22); }
  .bar b {
    margin-left: 10px;
    color: #9db5a0;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.4px;
  }
  .win img { display: block; width: 100%; }
</style></head>
<body>
  <div class="poster ${layout === 'single' ? 'single' : ''}">
    <div class="win main">
      <div class="bar"><i></i><i></i><i></i><b>${label}</b></div>
      <img src="${RAW}/${name}-main.png" />
    </div>
    ${
      layout === 'single'
        ? ''
        : `<div class="win side">
      <div class="bar"><i></i><i></i><i></i><b>${label}</b></div>
      <img src="${RAW}/${name}-side.png" />
    </div>`
    }
  </div>
</body></html>`

const capture = async (browser, shot, file) => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 1,
  })
  await page.goto(shot.url, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(shot.wait)
  if (shot.accept) {
    const btn = page.getByText(/^(accept|принять)$/i).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {})
      await page.waitForTimeout(600)
    }
  }
  if (shot.scrollY) {
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: 'instant' }),
      shot.scrollY,
    )
    await page.waitForTimeout(800)
  }
  await page.screenshot({ path: file })
  await page.close()
}

const main = async () => {
  fs.mkdirSync(RAW, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  for (const site of SITES) {
    await capture(browser, site.main, `${RAW}/${site.name}-main.png`)
    if (site.side)
      await capture(browser, site.side, `${RAW}/${site.name}-side.png`)

    const composer = await browser.newPage({
      viewport: { width: 1480, height: 1000 },
      deviceScaleFactor: 1,
    })
    const htmlFile = `${RAW}/${site.name}-poster.html`
    fs.writeFileSync(htmlFile, posterHtml(site.name, site.label, site.layout))
    await composer.goto('file://' + htmlFile)
    await composer.waitForTimeout(400)
    const png = `${RAW}/${site.name}-poster.png`
    await composer.locator('.poster').screenshot({ path: png })
    await composer.close()
    execSync(`magick ${png} -quality 82 ${OUT}/${site.name}-shot.webp`)
    const mean = execSync(
      `magick ${OUT}/${site.name}-shot.webp -colorspace gray -format "%[fx:mean*255]" info:`,
    ).toString()
    console.log(`${site.name}: mean luma ${Number(mean).toFixed(1)}`)
  }
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
