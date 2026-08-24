document.documentElement.classList.add('js')

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

const LANGS = ['ru', 'en', 'uz']
const STORAGE_KEY = 'portfolio-lang'

const detectLang = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && LANGS.includes(stored)) return stored
  } catch (err) {}
  const prefs =
    navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en']
  for (const pref of prefs) {
    const primary = String(pref).split('-')[0].toLowerCase()
    if (primary === 'uz') return 'uz'
    if (
      primary === 'ru' ||
      primary === 'be' ||
      primary === 'kk' ||
      primary === 'kg' ||
      primary === 'ky'
    )
      return 'ru'
    if (primary === 'en') return 'en'
  }
  return 'en'
}

const captureRuSnapshot = () => {
  const snapshot = { text: {}, html: {}, attr: {} }
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    snapshot.text[el.dataset.i18n] = el.textContent
  })
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    snapshot.html[el.dataset.i18nHtml] = el.innerHTML
  })
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [attr, key] = pair.split(':').map((part) => part.trim())
        if (!attr || !key) return
        snapshot.attr[key] = { attr, value: el.getAttribute(attr) }
      })
  })
  return snapshot
}

const applyLang = (lang, ruSnapshot) => {
  const dict = lang === 'ru' ? null : (window.I18N && window.I18N[lang]) || {}
  const misses = []

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n
    if (lang === 'ru') {
      el.textContent = ruSnapshot.text[key]
      return
    }
    if (key in dict) {
      el.textContent = dict[key]
    } else {
      el.textContent = ruSnapshot.text[key]
      misses.push(key)
    }
  })

  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.dataset.i18nHtml
    if (lang === 'ru') {
      el.innerHTML = ruSnapshot.html[key]
      return
    }
    if (key in dict) {
      el.innerHTML = dict[key]
    } else {
      el.innerHTML = ruSnapshot.html[key]
      misses.push(key)
    }
  })

  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [attr, key] = pair.split(':').map((part) => part.trim())
        if (!attr || !key) return
        const fallback = ruSnapshot.attr[key]
        if (lang === 'ru') {
          if (fallback) el.setAttribute(attr, fallback.value)
          return
        }
        if (key in dict) {
          el.setAttribute(attr, dict[key])
        } else {
          if (fallback) el.setAttribute(attr, fallback.value)
          misses.push(key)
        }
      })
  })

  document.documentElement.lang = lang

  if (misses.length) {
    console.warn(
      `[i18n] missing "${lang}" translation for: ${[...new Set(misses)].join(', ')}`,
    )
  }
}

const setupI18n = () => {
  const ruSnapshot = captureRuSnapshot()
  const switches = document.querySelectorAll('.lang-switch')
  let currentLang = detectLang()

  const syncSwitchUI = (lang) => {
    switches.forEach((group) => {
      group.querySelectorAll('[data-lang]').forEach((btn) => {
        const active = btn.dataset.lang === lang
        btn.classList.toggle('is-active', active)
        btn.setAttribute('aria-pressed', active ? 'true' : 'false')
      })
    })
  }

  const setLang = (lang, persist) => {
    if (!LANGS.includes(lang)) return
    currentLang = lang
    applyLang(lang, ruSnapshot)
    syncSwitchUI(lang)
    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, lang)
      } catch (err) {}
    }
    window.dispatchEvent(
      new CustomEvent('portfolio:lang', { detail: { lang } }),
    )
  }

  switches.forEach((group) => {
    group.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-lang]')
      if (!btn || !group.contains(btn)) return
      setLang(btn.dataset.lang, true)
    })
  })

  setLang(currentLang, false)
}

const setupReveal = () => {
  const targets = document.querySelectorAll('.reveal')
  if (reducedMotionQuery.matches) {
    targets.forEach((t) => t.classList.add('is-visible'))
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        const kids = entry.target.querySelectorAll(
          ':scope > .reveal-item, .reveal-stagger > *',
        )
        kids.forEach((kid, i) => {
          kid.style.setProperty('--d', String(i))
        })
        observer.unobserve(entry.target)
      })
    },
    { threshold: 0.08, rootMargin: '0px 0px -10% 0px' },
  )
  targets.forEach((t) => observer.observe(t))
}

const setupRowReveal = () => {
  const rows = [...document.querySelectorAll('.work-ledger .work-row')]
  if (!rows.length) return
  rows.forEach((row, i) => {
    row.style.setProperty('--d', String(i % 6))
  })
  if (reducedMotionQuery.matches) {
    rows.forEach((r) => r.classList.add('is-shown'))
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-shown')
        observer.unobserve(entry.target)
      })
    },
    { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
  )
  rows.forEach((r) => observer.observe(r))
}

const setupLedger = () => {
  const grid = document.querySelector('#workGrid')
  const items = [...document.querySelectorAll('.work-row details')]
  if (!items.length) return

  const syncFocus = () => {
    if (!grid) return
    let any = false
    document.querySelectorAll('.work-sat').forEach((sat) => {
      const open = sat.querySelector('details.is-open, details[open].is-open')
      const on = !!open
      sat.classList.toggle('is-focus', on)
      if (on) any = true
    })
    grid.classList.toggle('is-focusing', any)
  }

  items.forEach((details) => {
    const summary = details.querySelector('summary')
    const expand = details.querySelector('.row-expand')
    if (!summary || !expand) return
    let closeTimer = null
    let onCloseEnd = null

    const cancelPendingClose = () => {
      if (closeTimer) clearTimeout(closeTimer)
      if (onCloseEnd) expand.removeEventListener('transitionend', onCloseEnd)
      closeTimer = null
      onCloseEnd = null
    }

    const openRow = () => {
      items.forEach((other) => {
        if (other === details) return
        if (other.open || other.classList.contains('is-open')) {
          other.classList.remove('is-open')
          other.open = false
        }
      })
      cancelPendingClose()
      details.open = true
      requestAnimationFrame(() => {
        details.classList.add('is-open')
        syncFocus()
        const sat = details.closest('.work-sat')
        if (sat && !reducedMotionQuery.matches) {
          const top = sat.getBoundingClientRect().top + window.scrollY - 96
          window.scrollTo({ top, behavior: 'smooth' })
        }
      })
    }

    const closeRow = () => {
      details.classList.remove('is-open')
      syncFocus()
      const finish = (event) => {
        if (
          event &&
          (event.target !== expand ||
            event.propertyName !== 'grid-template-rows')
        )
          return
        if (details.classList.contains('is-open')) return
        cancelPendingClose()
        details.open = false
        syncFocus()
      }
      onCloseEnd = finish
      expand.addEventListener('transitionend', finish)
      closeTimer = setTimeout(finish, 450)
    }

    summary.addEventListener('click', (event) => {
      if (reducedMotionQuery.matches) {
        requestAnimationFrame(() => {
          if (details.open) {
            items.forEach((other) => {
              if (other !== details) {
                other.open = false
                other.classList.remove('is-open')
              }
            })
          }
          syncFocus()
        })
        return
      }
      event.preventDefault()
      if (details.classList.contains('is-open')) closeRow()
      else openRow()
    })

    details.addEventListener('toggle', () => {
      if (details.open) {
        if (!details.classList.contains('is-open')) {
          requestAnimationFrame(() => {
            details.classList.add('is-open')
            syncFocus()
          })
        } else {
          syncFocus()
        }
      } else {
        details.classList.remove('is-open')
        cancelPendingClose()
        syncFocus()
      }
    })
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    const open = document.querySelector('.work-row details.is-open')
    if (!open) return
    open.classList.remove('is-open')
    open.open = false
    syncFocus()
  })
}

const setupFilter = () => {
  const chips = document.querySelectorAll('.filter-chip')
  const rows = document.querySelectorAll('#workGrid .work-row')
  const empty = document.querySelector('#workEmpty')
  if (!chips.length || !rows.length) return

  const applyFilter = (filter) => {
    const next = filter || 'all'
    chips.forEach((chip) => {
      const active = chip.dataset.filter === next
      chip.classList.toggle('is-active', active)
      chip.setAttribute('aria-pressed', active ? 'true' : 'false')
    })
    let visible = 0
    const grid = document.querySelector('#workGrid')
    rows.forEach((row) => {
      const categories = (row.dataset.category || '').split(' ')
      const show = next === 'all' || categories.includes(next)
      row.classList.toggle('is-hidden', !show)
      if (!show) {
        const details = row.querySelector('details')
        if (details) {
          details.open = false
          details.classList.remove('is-open')
        }
        row.classList.remove('is-focus')
      }
      if (show) {
        row.classList.add('is-shown')
        visible += 1
      }
    })
    if (grid) grid.classList.remove('is-focusing')
    if (empty) empty.hidden = visible > 0
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      applyFilter(chip.dataset.filter)
    })
  })

  document.querySelectorAll('[data-work-filter]').forEach((card) => {
    card.addEventListener('click', () => {
      applyFilter(card.dataset.workFilter)
    })
  })
}

const setupRail = () => {
  const links = document.querySelectorAll('.rail a[data-rail]')
  const sections = document.querySelectorAll('[data-section]')
  if (!links.length || !sections.length) return
  const byName = new Map()
  links.forEach((link) => byName.set(link.dataset.rail, link))
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const link = byName.get(entry.target.dataset.section)
        if (!link) return
        links.forEach((l) => l.classList.toggle('is-active', l === link))
      })
    },
    { rootMargin: '-45% 0px -45% 0px' },
  )
  sections.forEach((s) => observer.observe(s))
}

const setupClock = () => {
  const el = document.querySelector('[data-clock]')
  if (!el) return
  const target = el.querySelector('b') || el
  const format = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tashkent',
  })
  const tick = () => {
    target.textContent = format.format(new Date())
  }
  tick()
  el.hidden = false
  setInterval(tick, 30000)
}

const setupMobileNav = () => {
  const toggle = document.querySelector('.nav-toggle')
  const menu = document.querySelector('.mobile-nav')
  if (!toggle || !menu) return
  const panel = menu.querySelector('.mobile-nav-panel')
  const firstLink = menu.querySelector('a')
  let lastFocused = null

  const navLabel = (key, ruFallback) => {
    const lang = document.documentElement.lang || 'ru'
    if (lang === 'ru') return ruFallback
    const dict = (window.I18N && window.I18N[lang]) || {}
    return dict[key] || ruFallback
  }

  const syncToggleLabel = (isOpen) => {
    toggle.setAttribute(
      'aria-label',
      isOpen
        ? navLabel('mobileNav.closeLabel', 'Закрыть меню')
        : navLabel('mobileNav.openLabel', 'Открыть меню'),
    )
  }

  const open = () => {
    lastFocused = document.activeElement
    menu.hidden = false
    requestAnimationFrame(() => {
      menu.classList.add('is-open')
      document.body.classList.add('nav-open')
      toggle.setAttribute('aria-expanded', 'true')
      syncToggleLabel(true)
      if (firstLink) firstLink.focus({ preventScroll: true })
    })
  }

  const close = () => {
    menu.classList.remove('is-open')
    document.body.classList.remove('nav-open')
    toggle.setAttribute('aria-expanded', 'false')
    syncToggleLabel(false)
    const finish = (event) => {
      if (event && event.target !== panel) return
      if (!menu.classList.contains('is-open')) menu.hidden = true
      panel.removeEventListener('transitionend', finish)
    }
    panel.addEventListener('transitionend', finish)
    setTimeout(finish, 500)
    if (lastFocused) lastFocused.focus({ preventScroll: true })
  }

  toggle.addEventListener('click', () => {
    if (menu.classList.contains('is-open')) close()
    else open()
  })
  menu
    .querySelectorAll('[data-nav-close]')
    .forEach((el) => el.addEventListener('click', close))
  window.addEventListener('portfolio:lang', () => {
    syncToggleLabel(menu.classList.contains('is-open'))
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) close()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !menu.classList.contains('is-open')) return
    const focusable = [...panel.querySelectorAll('a, button'), toggle]
    if (!focusable.length) return
    event.preventDefault()
    const index = focusable.indexOf(document.activeElement)
    const step = event.shiftKey ? -1 : 1
    const next =
      index === -1
        ? event.shiftKey
          ? focusable.length - 1
          : 0
        : (index + step + focusable.length) % focusable.length
    focusable[next].focus()
  })
  window
    .matchMedia('(min-width: 1081px)')
    .addEventListener('change', (event) => {
      if (event.matches && menu.classList.contains('is-open')) close()
    })
}

const setupAnchorScroll = () => {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]')
    if (!link) return
    const href = link.getAttribute('href')
    if (!href || href === '#') return
    const id = href.slice(1)
    const target =
      document.getElementById(id) ||
      document.querySelector(`[data-section="${id}"]`)
    if (!target) return
    event.preventDefault()
    const top = target.getBoundingClientRect().top + window.scrollY - 88
    window.scrollTo({
      top,
      behavior: reducedMotionQuery.matches ? 'auto' : 'smooth',
    })
    history.pushState(null, '', href)
  })
}

const setupSpotlight = () => {
  const el = document.getElementById('spotlight')
  if (!el || reducedMotionQuery.matches) return
  if (window.matchMedia('(pointer: coarse)').matches) return
  let on = false
  const move = (event) => {
    el.style.setProperty('--sx', `${event.clientX}px`)
    el.style.setProperty('--sy', `${event.clientY}px`)
    if (!on) {
      el.classList.add('is-on')
      on = true
    }
  }
  window.addEventListener('pointermove', move, { passive: true })
  document.addEventListener('pointerleave', () => {
    el.classList.remove('is-on')
    on = false
  })
}

const setupMagnetic = () => {
  if (reducedMotionQuery.matches) return
  if (window.matchMedia('(pointer: coarse)').matches) return
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = 8
    el.addEventListener('pointermove', (event) => {
      const rect = el.getBoundingClientRect()
      const x = event.clientX - rect.left - rect.width / 2
      const y = event.clientY - rect.top - rect.height / 2
      el.style.setProperty('--mx', `${(x / rect.width) * strength}px`)
      el.style.setProperty('--my', `${(y / rect.height) * strength}px`)
    })
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--mx', '0px')
      el.style.setProperty('--my', '0px')
    })
  })
}

const setupTilt = () => {
  if (reducedMotionQuery.matches) return
  if (window.matchMedia('(pointer: coarse)').matches) return
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const max = el.classList.contains('receipt') ? 7 : 9
    el.addEventListener('pointermove', (event) => {
      const rect = el.getBoundingClientRect()
      const px = (event.clientX - rect.left) / rect.width - 0.5
      const py = (event.clientY - rect.top) / rect.height - 0.5
      const rx = (-py * max).toFixed(2)
      const ry = (px * max).toFixed(2)
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(0,0,0)`
    })
    el.addEventListener('pointerleave', () => {
      el.style.transform = ''
    })
  })
}

const splitHeroTitle = (h1) => {
  if (!h1) return
  const html = h1.innerHTML.trim()
  const tokens = []
  const re = /(<[^>]+>)|([^<\s]+)|(\s+)/g
  let match
  let open = ''
  while ((match = re.exec(html))) {
    if (match[1]) {
      if (/^<\//.test(match[1])) {
        open += match[1]
        tokens.push(open)
        open = ''
      } else {
        open = match[1]
      }
      continue
    }
    if (match[3]) {
      if (open) open += match[3]
      else if (tokens.length) tokens.push(' ')
      continue
    }
    if (match[2]) {
      if (open) open += match[2]
      else tokens.push(match[2])
    }
  }
  if (open) tokens.push(open)
  const words = tokens.filter((t) => t && t !== ' ')
  const mid = Math.max(1, Math.ceil(words.length / 2))
  const lines = [words.slice(0, mid), words.slice(mid)].filter((l) => l.length)
  h1.innerHTML = lines
    .map(
      (line) =>
        `<span class="line"><span class="line-inner">${line.join(' ')}</span></span>`,
    )
    .join('')
}

const setupHeroMotion = () => {
  const copy = document.querySelector('.hero-copy')
  const stage = document.querySelector('.hero-stage')
  const h1 = document.querySelector('.hero-copy h1')
  if (!copy || !h1) return

  const run = () => {
    copy.classList.remove('is-ready')
    if (stage) stage.classList.remove('is-ready')
    if (!reducedMotionQuery.matches) {
      splitHeroTitle(h1)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          copy.classList.add('is-ready')
          if (stage) stage.classList.add('is-ready')
        })
      })
    } else {
      copy.classList.add('is-ready')
      if (stage) stage.classList.add('is-ready')
    }
  }

  run()
  window.addEventListener('portfolio:lang', () => {
    window.setTimeout(run, 30)
  })
}

const setupFilterMotion = () => {
  if (reducedMotionQuery.matches) return
  const chips = document.querySelectorAll('.filter-chip')
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chip.animate(
        [
          { transform: 'scale(0.9)', offset: 0 },
          { transform: 'scale(1.08)', offset: 0.45 },
          { transform: 'scale(0.98)', offset: 0.75 },
          { transform: 'scale(1)', offset: 1 },
        ],
        { duration: 420, easing: 'cubic-bezier(0.22, 1.35, 0.36, 1)' },
      )
    })
  })
}

const setupCardMotion = () => {}

const setupCountPulse = () => {}

const setupScrollProgress = () => {
  const bar = document.querySelector('.scroll-progress > i')
  if (!bar) return
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
    bar.style.setProperty('--p', String(p))
  }
  update()
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update, { passive: true })
}

const setupCounters = () => {
  const nodes = document.querySelectorAll('[data-count]')
  if (!nodes.length) return
  if (reducedMotionQuery.matches) return

  const animate = (el) => {
    const target = Number(el.dataset.count)
    if (!Number.isFinite(target)) return
    const duration = 1200
    const start = performance.now()
    const from = 0
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      el.textContent = String(Math.round(from + (target - from) * eased))
      if (t < 1) requestAnimationFrame(step)
      else el.textContent = String(target)
    }
    requestAnimationFrame(step)
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        animate(entry.target)
        observer.unobserve(entry.target)
      })
    },
    { threshold: 0.4 },
  )
  nodes.forEach((n) => observer.observe(n))
}

const setupReceiptFloat = () => {
  if (reducedMotionQuery.matches) return
  const core = document.querySelector('.orbit-core')
  if (!core) return
  window.setTimeout(() => {
    core.classList.add('is-floating')
  }, 900)
}

const setupStarfield = () => {
  const canvas = document.getElementById('starfield')
  if (!canvas || reducedMotionQuery.matches) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let stars = []
  let raf = 0
  let w = 0
  let h = 0
  let dpr = 1
  let frame = 0

  const rebuild = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const count = Math.min(70, Math.floor((w * h) / 28000))
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.25,
      a: Math.random() * 0.45 + 0.18,
      s: Math.random() * 0.2 + 0.04,
      p: Math.random() * Math.PI * 2,
    }))
  }

  const draw = (t) => {
    frame += 1
    if (frame % 2 === 0) {
      ctx.clearRect(0, 0, w, h)
      const time = t * 0.001
      for (const star of stars) {
        const twinkle = 0.6 + 0.4 * Math.sin(time * star.s * 5 + star.p)
        ctx.fillStyle = `rgba(180, 210, 255, ${star.a * twinkle})`
        ctx.fillRect(star.x, star.y, star.r, star.r)
      }
    }
    raf = requestAnimationFrame(draw)
  }

  rebuild()
  raf = requestAnimationFrame(draw)
  let resizeTimer = 0
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(rebuild, 120)
    },
    { passive: true },
  )
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf)
      raf = 0
    } else if (!raf) {
      raf = requestAnimationFrame(draw)
    }
  })
}

const CONTACT = {
  telegramUser: 'ruzibekov_sh',
  email: 'ruzibekov01@gmail.com',
}

const contactCopy = (key, lang) => {
  const ru = {
    'contact.mailSubject': 'Заказ с портфолио',
    'contact.greeting': 'Здравствуйте! Меня зовут {name}.',
    'contact.greetingAnon': 'Здравствуйте!',
    'contact.errorRequired': 'Напишите кратко, что нужно сделать.',
  }
  if (lang === 'ru') return ru[key] || ''
  const dict = (window.I18N && window.I18N[lang]) || {}
  return dict[key] || ru[key] || ''
}

const currentLang = () => document.documentElement.lang || 'ru'

const buildContactMessage = (name, message, lang) => {
  const trimmedName = name.trim()
  const trimmedMessage = message.trim()
  const greeting = trimmedName
    ? contactCopy('contact.greeting', lang).replace('{name}', trimmedName)
    : contactCopy('contact.greetingAnon', lang)
  return `${greeting}\n\n${trimmedMessage}`
}

const openExternal = (url) => {
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    window.location.href = url
  }
}

const setupContactForm = () => {
  const form = document.getElementById('contactForm')
  if (!form) return
  const nameInput = form.querySelector('#contactName')
  const messageInput = form.querySelector('#contactMessage')
  const errorEl = form.querySelector('#contactError')
  const messageField = messageInput
    ? messageInput.closest('.contact-field')
    : null
  let lastChannel = 'telegram'

  form.querySelectorAll('[data-channel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      lastChannel = btn.dataset.channel || 'telegram'
    })
  })

  const showError = (show) => {
    if (errorEl) errorEl.hidden = !show
    if (messageField) messageField.classList.toggle('is-invalid', show)
    if (show && messageInput) messageInput.focus()
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const channel =
      (event.submitter && event.submitter.dataset.channel) || lastChannel
    const name = nameInput ? nameInput.value : ''
    const message = messageInput ? messageInput.value : ''
    if (!message.trim()) {
      showError(true)
      return
    }
    showError(false)
    const lang = currentLang()
    const body = buildContactMessage(name, message, lang)
    if (channel === 'email') {
      const subject = encodeURIComponent(
        contactCopy('contact.mailSubject', lang),
      )
      const mailBody = encodeURIComponent(body)
      window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${mailBody}`
      return
    }
    const url = `https://t.me/${CONTACT.telegramUser}?text=${encodeURIComponent(body)}`
    openExternal(url)
  })

  if (messageInput) {
    messageInput.addEventListener('input', () => {
      if (messageInput.value.trim()) showError(false)
    })
  }
}

const THEME_KEY = 'portfolio-theme'

const getPreferredTheme = () => {
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch (err) {}
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

const applyTheme = (theme) => {
  const next = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  const meta = document.getElementById('themeColorMeta')
  if (meta) meta.content = next === 'light' ? '#eef1f6' : '#05070d'
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    const pressed = next === 'light'
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false')
  })
}

const setupTheme = () => {
  applyTheme(getPreferredTheme())
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current =
        document.documentElement.getAttribute('data-theme') === 'light'
          ? 'light'
          : 'dark'
      const next = current === 'light' ? 'dark' : 'light'
      applyTheme(next)
      try {
        window.localStorage.setItem(THEME_KEY, next)
      } catch (err) {}
    })
  })
  const mq = window.matchMedia('(prefers-color-scheme: light)')
  const onSystem = (event) => {
    try {
      if (window.localStorage.getItem(THEME_KEY)) return
    } catch (err) {
      return
    }
    applyTheme(event.matches ? 'light' : 'dark')
  }
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onSystem)
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(onSystem)
  }
}

setupTheme()
setupI18n()
setupAnchorScroll()
setupSpotlight()
setupMagnetic()
setupTilt()
setupHeroMotion()
setupReveal()
setupRowReveal()
setupLedger()
setupFilter()
setupFilterMotion()
setupCardMotion()
setupScrollProgress()
setupCounters()
setupCountPulse()
setupReceiptFloat()
setupStarfield()

setupContactForm()
setupRail()
setupClock()
setupMobileNav()
