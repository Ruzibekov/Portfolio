import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  closeBrowser,
  contrast,
  openPage,
  rgb,
  scrollThrough,
  startServer,
} from './harness.mjs'

let server

before(async () => {
  server = await startServer()
})

after(async () => {
  await closeBrowser()
  await server.close()
})

const withPage = async (options, run) => {
  const page = await openPage(server.origin, options)
  try {
    return await run(page)
  } finally {
    await page.closeContext()
  }
}

describe('profile figures', () => {
  test('rating, orders and reviews render as static text', async () => {
    await withPage({}, async (page) => {
      const figures = await page.$$eval('.profile-lines b', (nodes) =>
        nodes.map((node) => node.textContent.trim()),
      )
      assert.deepEqual(figures, ['5.0', '19', '15'])
      assert.equal(await page.locator('[data-count]').count(), 0)
    })
  })
})

describe('work filter', () => {
  test('chip counts are derived from the rendered projects', async () => {
    await withPage({}, async (page) => {
      const state = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#workGrid .work-row')]
        const has = (row, filter) =>
          filter === 'all' ||
          (row.dataset.category || '').split(' ').includes(filter)
        return [...document.querySelectorAll('.filter-chip')].map((chip) => ({
          filter: chip.dataset.filter,
          badge: Number(chip.querySelector('b').textContent),
          actual: rows.filter((row) => has(row, chip.dataset.filter)).length,
        }))
      })
      assert.ok(state.length >= 2)
      for (const chip of state)
        assert.equal(
          chip.badge,
          chip.actual,
          `chip "${chip.filter}" claims ${chip.badge} but ${chip.actual} projects match`,
        )
    })
  })

  test('selecting a chip shows exactly the promised projects', async () => {
    await withPage({}, async (page) => {
      await scrollThrough(page)
      for (const filter of ['mobile', 'web', 'backend', 'all']) {
        await page.click(`.filter-chip[data-filter="${filter}"]`)
        await page.waitForTimeout(250)
        const result = await page.evaluate((current) => {
          const chip = document.querySelector(
            `.filter-chip[data-filter="${current}"]`,
          )
          const rows = [...document.querySelectorAll('#workGrid .work-row')]
          return {
            badge: Number(chip.querySelector('b').textContent),
            visible: rows.filter(
              (row) => getComputedStyle(row).display !== 'none',
            ).length,
            pressed: chip.getAttribute('aria-pressed'),
          }
        }, filter)
        assert.equal(result.pressed, 'true', `${filter} not marked pressed`)
        assert.equal(
          result.visible,
          result.badge,
          `${filter}: badge ${result.badge}, visible ${result.visible}`,
        )
      }
    })
  })
})

describe('reveal', () => {
  test('every revealed section becomes visible while scrolling', async () => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await withPage({ width, height }, async (page) => {
        await scrollThrough(page)
        const hidden = await page.evaluate(() =>
          [...document.querySelectorAll('.reveal')]
            .filter((el) => !el.classList.contains('is-visible'))
            .map((el) => el.id || el.className),
        )
        assert.deepEqual(hidden, [], `hidden sections at ${width}px`)
      })
    }
  })

  test('reduced motion shows every project row immediately', async () => {
    await withPage({ reducedMotion: 'reduce' }, async (page) => {
      const state = await page.evaluate(() => ({
        rows: document.querySelectorAll('#workGrid .work-row').length,
        shown: document.querySelectorAll('#workGrid .work-row.is-shown').length,
        lingering: document
          .getAnimations()
          .filter((animation) => {
            if (animation.playState !== 'running') return false
            const timing = animation.effect && animation.effect.getTiming()
            if (!timing) return false
            return (
              timing.iterations === Infinity || Number(timing.duration) > 100
            )
          })
          .map((animation) => animation.animationName || 'transition'),
      }))
      assert.equal(state.shown, state.rows)
      assert.deepEqual(state.lingering, [], 'motion still runs when reduced')
    })
  })
})

describe('project cards', () => {
  test('no description is clipped by the line clamp', async () => {
    for (const [width, height] of [
      [1440, 900],
      [834, 1112],
      [390, 844],
    ]) {
      await withPage({ width, height }, async (page) => {
        await scrollThrough(page)
        const clipped = await page.$$eval('.work-sat-desc', (nodes) =>
          nodes
            .filter((node) => node.scrollHeight > node.clientHeight + 1)
            .map((node) => node.textContent.trim().slice(0, 40)),
        )
        assert.deepEqual(clipped, [], `clipped descriptions at ${width}px`)
      })
    }
  })

  test('collapsed cards share one height, no ragged grid row', async () => {
    await withPage({}, async (page) => {
      await scrollThrough(page)
      const rows = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#workGrid .work-row')]
        const byTop = new Map()
        for (const card of cards) {
          const box = card.getBoundingClientRect()
          const key = Math.round(box.top + window.scrollY)
          if (!byTop.has(key)) byTop.set(key, [])
          byTop.get(key).push({
            title: card.querySelector('.work-sat-title').textContent.trim(),
            height: Math.round(box.height),
          })
        }
        return [...byTop.values()].filter((group) => group.length > 1)
      })
      assert.ok(rows.length >= 2, 'grid did not form multi-card rows')
      for (const group of rows) {
        const heights = group.map((card) => card.height)
        const spread = Math.max(...heights) - Math.min(...heights)
        assert.ok(
          spread <= 1,
          `ragged row: ${group.map((c) => `${c.title} ${c.height}px`).join(', ')}`,
        )
      }
    })
  })

  test('card padding is symmetric around its text block', async () => {
    await withPage({}, async (page) => {
      const boxes = await page.$$eval('#workGrid .work-sat-body', (nodes) =>
        nodes.slice(0, 6).map((node) => {
          const style = getComputedStyle(node)
          return {
            top: style.paddingTop,
            bottom: style.paddingBottom,
            left: style.paddingLeft,
            right: style.paddingRight,
          }
        }),
      )
      assert.ok(boxes.length >= 3)
      for (const box of boxes) {
        assert.equal(box.top, box.bottom)
        assert.equal(box.left, box.right)
      }
    })
  })

  test('a collapsed project reserves no space for its case panel', async () => {
    await withPage({}, async (page) => {
      await scrollThrough(page)
      const heights = await page.$$eval('#workGrid .row-expand', (nodes) =>
        nodes.map((node) => node.getBoundingClientRect().height),
      )
      for (const height of heights)
        assert.ok(height <= 2, `collapsed panel keeps ${height}px`)
    })
  })

  test('an opened project shows its full case study', async () => {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await withPage({ width, height }, async (page) => {
        await scrollThrough(page)
        await page.click('#workGrid .work-row:first-child .work-sat-face')
        await page.waitForTimeout(800)
        const state = await page.evaluate(() => {
          const card = document.querySelector('#workGrid .work-row')
          const copy = card.querySelector('.work-sat-dock-copy')
          return {
            open: card.querySelector('details').open,
            panel: card.querySelector('.row-expand').getBoundingClientRect()
              .height,
            terms: [...card.querySelectorAll('.work-case dt')].map((node) =>
              node.textContent.trim(),
            ),
            clipped: copy.scrollHeight > copy.clientHeight + 1,
            links: card.querySelectorAll('.work-links a').length,
          }
        })
        assert.ok(state.open, `${width}px: card did not open`)
        assert.ok(
          state.panel > 100,
          `${width}px: case panel only ${state.panel.toFixed(0)}px tall`,
        )
        assert.equal(state.terms.length, 3, `${width}px: case rows missing`)
        assert.equal(state.clipped, false, `${width}px: case text clipped`)
        assert.ok(state.links >= 1, `${width}px: no project links`)
      })
    }
  })
})

describe('layout', () => {
  test('no horizontal overflow on any viewport', async () => {
    for (const [width, height] of [
      [1440, 900],
      [834, 1112],
      [390, 844],
    ]) {
      await withPage({ width, height }, async (page) => {
        await scrollThrough(page)
        const overflow = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }))
        assert.ok(
          overflow.scroll <= overflow.client,
          `${width}px overflows by ${overflow.scroll - overflow.client}px`,
        )
      })
    }
  })

  test('the mobile hero leads with the headline, not the profile card', async () => {
    await withPage({ width: 390, height: 844 }, async (page) => {
      const order = await page.evaluate(() => ({
        copy: document.querySelector('.hero-copy').getBoundingClientRect().top,
        stage: document.querySelector('.hero-stage').getBoundingClientRect()
          .top,
        cta: document
          .querySelector('.hero-copy .button.primary')
          .getBoundingClientRect().bottom,
        dockTop: document.querySelector('.mobile-dock').getBoundingClientRect()
          .top,
      }))
      assert.ok(order.copy < order.stage, 'profile card renders above the copy')
      assert.ok(
        order.cta < order.dockTop,
        'hero CTA sits behind the sticky dock',
      )
    })
  })
})

describe('accessibility', () => {
  test('interactive controls meet the 44px touch target', async () => {
    await withPage({ width: 390, height: 844 }, async (page) => {
      await scrollThrough(page)
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '.nav a, .filter-chip, .work-link, .lang-switch button, .header-action, .button, .mobile-dock-btn',
          ),
        ]
          .map((el) => ({
            label: el.textContent.trim().slice(0, 24),
            height: el.getBoundingClientRect().height,
          }))
          .filter((el) => el.height > 0 && el.height < 44),
      )
      assert.deepEqual(small, [])
    })
  })

  test('the mobile menu can be closed from inside the panel', async () => {
    await withPage({ width: 390, height: 844 }, async (page) => {
      await page.click('.nav-toggle')
      await page.waitForTimeout(400)
      const closer = await page.evaluate(() => {
        const panel = document.querySelector('.mobile-nav-panel')
        const button = panel.querySelector('button[data-nav-close]')
        if (!button) return null
        const box = button.getBoundingClientRect()
        const panelBox = panel.getBoundingClientRect()
        return {
          inside:
            box.left >= panelBox.left - 1 && box.right <= panelBox.right + 1,
          size: Math.min(box.width, box.height),
        }
      })
      assert.ok(closer, 'no close control inside the menu panel')
      assert.ok(closer.inside, 'close control sits outside the panel')
      assert.ok(closer.size >= 44, `close control is only ${closer.size}px`)
      await page.click('.mobile-nav-panel button[data-nav-close]')
      await page.waitForTimeout(600)
      assert.equal(
        await page.evaluate(() =>
          document.querySelector('.mobile-nav').classList.contains('is-open'),
        ),
        false,
      )
    })
  })

  test('focus ring is themed, not the browser default', async () => {
    await withPage({}, async (page) => {
      const ring = await page.evaluate(() => {
        const link = document.querySelector('.nav a')
        link.focus()
        const style = getComputedStyle(link)
        return {
          width: style.outlineWidth,
          style: style.outlineStyle,
          color: style.outlineColor,
          accent: getComputedStyle(document.documentElement)
            .getPropertyValue('--accent-2')
            .trim(),
        }
      })
      assert.equal(ring.style, 'solid')
      assert.equal(ring.width, '2px')
      assert.notEqual(ring.color, 'rgb(0, 95, 204)')
    })
  })

  test('the brief error message is wired to its field', async () => {
    await withPage({}, async (page) => {
      const described = await page.getAttribute(
        '#contactMessage',
        'aria-describedby',
      )
      assert.equal(described, 'contactError')
      await page.click('#contactForm button[type="submit"]')
      await page.waitForTimeout(300)
      assert.equal(await page.getAttribute('#contactError', 'hidden'), null)
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        'contactMessage',
      )
      await page.fill('#contactMessage', 'Лендинг для салона, срок 2 недели')
      await page.click('[data-copy-brief]')
      await page.waitForTimeout(300)
      assert.equal(await page.getAttribute('#contactError', 'hidden'), '')
    })
  })

  test('muted body text clears WCAG AA against its surface', async () => {
    for (const theme of ['dark', 'light']) {
      await withPage({ theme }, async (page) => {
        const tokens = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement)
          const read = (name) => style.getPropertyValue(name).trim()
          const toRgb = (value) => {
            const probe = document.createElement('span')
            probe.style.color = value
            document.body.append(probe)
            const resolved = getComputedStyle(probe).color
            probe.remove()
            return resolved
          }
          return {
            muted: toRgb(read('--muted')),
            surface: toRgb(read('--surface')),
            bg: toRgb(read('--bg')),
            ink: toRgb(read('--ink')),
          }
        })
        assert.ok(
          contrast(rgb(tokens.muted), rgb(tokens.surface)) >= 4.5,
          `${theme}: muted on surface too low`,
        )
        assert.ok(
          contrast(rgb(tokens.ink), rgb(tokens.bg)) >= 4.5,
          `${theme}: ink on background too low`,
        )
      })
    }
  })

  test('the primary call to action keeps readable text', async () => {
    for (const theme of ['dark', 'light']) {
      await withPage({ theme }, async (page) => {
        const cta = await page.evaluate(() => {
          const button = document.querySelector('.hero-copy .button.primary')
          const style = getComputedStyle(button)
          return {
            color: style.color,
            background: style.backgroundColor,
            image: style.backgroundImage,
          }
        })
        assert.equal(cta.image, 'none', `${theme}: CTA still uses a gradient`)
        assert.ok(
          contrast(rgb(cta.color), rgb(cta.background)) >= 4.5,
          `${theme}: CTA contrast below AA`,
        )
      })
    }
  })
})

describe('content', () => {
  test('each proof number is stated once', async () => {
    await withPage({}, async (page) => {
      const repeated = await page.evaluate(() => {
        const seen = new Map()
        for (const node of document.querySelectorAll('.profile-lines b')) {
          const key = node.textContent.trim()
          seen.set(key, (seen.get(key) || 0) + 1)
        }
        return [...seen].filter(([, count]) => count > 1).map(([key]) => key)
      })
      assert.deepEqual(repeated, [], 'the same figure is shown twice')
    })
  })

  test('the primary call to action is not repeated above the fold', async () => {
    await withPage({}, async (page) => {
      const visible = await page.evaluate(() => {
        const label = document
          .querySelector('.hero-copy .button.primary')
          .textContent.trim()
        return [...document.querySelectorAll('a, button')].filter((el) => {
          if (el.textContent.trim() !== label) return false
          const box = el.getBoundingClientRect()
          return box.height > 0 && box.top < window.innerHeight
        }).length
      })
      assert.ok(
        visible <= 2,
        `${visible} identical CTAs share the first screen`,
      )
    })
  })

  test('contact offers a single Kwork action', async () => {
    await withPage({}, async (page) => {
      const kworkButtons = await page.$$eval(
        '#contact a, #contact button',
        (nodes) =>
          nodes
            .map((node) => node.textContent.trim())
            .filter((text) => /kwork/i.test(text)),
      )
      assert.equal(
        kworkButtons.filter((text) => /^(Открыть|Написать)/.test(text)).length,
        1,
      )
    })
  })

  test('no template tells: kickers, accent words, dashes, clock, status dot', async () => {
    for (const lang of ['ru', 'en', 'uz']) {
      await withPage({}, async (page) => {
        await page.click(`.site-header [data-lang="${lang}"]`)
        const report = await page.evaluate(() => {
          const visible = (node) => node.getClientRects().length > 0
          const headings = [
            ...document.querySelectorAll('h1, h2, h3, [role="heading"]'),
          ]
            .filter(visible)
            .map((node) => node.textContent.trim())
          const mono = [...document.querySelectorAll('body *')]
            .filter(visible)
            .filter(
              (node) =>
                node.childNodes.length &&
                /mono/i.test(getComputedStyle(node).fontFamily),
            )
            .map((node) => node.className || node.tagName)
          const upper = [...document.querySelectorAll('body *')]
            .filter(visible)
            .filter(
              (node) => getComputedStyle(node).textTransform === 'uppercase',
            )
            .map((node) => node.className || node.tagName)
          return {
            dashed: headings.filter((text) => text.includes('—')),
            accent: document.querySelectorAll('h1 em, h2 em').length,
            kickers: document.querySelectorAll('.eyebrow').length,
            clock: document.querySelectorAll('[data-clock]').length,
            dot: document.querySelectorAll('.availability-dot').length,
            mono,
            upper,
          }
        })
        assert.deepEqual(
          report,
          {
            dashed: [],
            accent: 0,
            kickers: 0,
            clock: 0,
            dot: 0,
            mono: [],
            upper: [],
          },
          lang,
        )
      })
    }
  })

  test('every language renders without missing keys', async () => {
    for (const lang of ['ru', 'en', 'uz']) {
      await withPage({ lang }, async (page) => {
        await page.waitForTimeout(600)
        const missing = page.problems.filter((entry) =>
          entry.includes('[i18n]'),
        )
        assert.deepEqual(missing, [], `${lang} has untranslated keys`)
        const labels = await page.$$eval('.system-card-cta', (nodes) =>
          nodes.map((node) => node.textContent.trim()),
        )
        assert.equal(new Set(labels).size, labels.length, `${lang} repeats CTA`)
      })
    }
  })
})

describe('design system', () => {
  test('nothing on the page paints a gradient', async () => {
    for (const theme of ['dark', 'light']) {
      await withPage({ theme }, async (page) => {
        await scrollThrough(page)
        const painted = await page.evaluate(() =>
          [...document.querySelectorAll('body *')]
            .filter((el) => {
              const style = getComputedStyle(el)
              return [
                style.backgroundImage,
                getComputedStyle(el, '::before').backgroundImage,
                getComputedStyle(el, '::after').backgroundImage,
              ].some((value) => value && value.includes('gradient'))
            })
            .map((el) => el.className || el.tagName)
            .slice(0, 10),
        )
        assert.deepEqual(painted, [], `${theme}: gradients still painted`)
      })
    }
  })

  test('no animation loops once the page has settled', async () => {
    await withPage({}, async (page) => {
      await scrollThrough(page)
      await page.waitForTimeout(1200)
      const looping = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => {
            const timing = animation.effect && animation.effect.getTiming()
            return timing && timing.iterations === Infinity
          })
          .map((animation) => animation.animationName || 'transition'),
      )
      assert.deepEqual(looping, [], 'an animation still loops forever')
    })
  })

  test('both themes render the same element tree', async () => {
    const counts = []
    for (const theme of ['dark', 'light']) {
      await withPage({ theme }, async (page) => {
        await scrollThrough(page)
        counts.push(
          await page.evaluate(() => document.querySelectorAll('body *').length),
        )
      })
    }
    assert.equal(counts[0], counts[1], 'theme variants differ in structure')
  })

  test('link colour clears AA on every surface it sits on', async () => {
    for (const theme of ['dark', 'light']) {
      await withPage({ theme }, async (page) => {
        const tokens = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement)
          const toRgb = (name) => {
            const probe = document.createElement('span')
            probe.style.color = style.getPropertyValue(name).trim()
            document.body.append(probe)
            const resolved = getComputedStyle(probe).color
            probe.remove()
            return resolved
          }
          return {
            link: toRgb('--accent-2'),
            bg: toRgb('--bg'),
            surface: toRgb('--surface'),
            raise: toRgb('--raise'),
          }
        })
        for (const surface of ['bg', 'surface', 'raise'])
          assert.ok(
            contrast(rgb(tokens.link), rgb(tokens[surface])) >= 4.5,
            `${theme}: link on ${surface} below AA`,
          )
      })
    }
  })
})

describe('runtime', () => {
  test('the page loads clean in both themes', async () => {
    for (const theme of ['dark', 'light']) {
      await withPage({ theme }, async (page) => {
        await scrollThrough(page)
        assert.deepEqual(page.problems, [], `${theme} reported problems`)
      })
    }
  })
})
