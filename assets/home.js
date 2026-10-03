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
        observer.unobserve(entry.target)
      })
    },
    { threshold: 0, rootMargin: '0px 0px -8% 0px' },
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
  const items = [...document.querySelectorAll('.work-row details')]
  if (!items.length) return

  const syncFocus = () => {
    document.querySelectorAll('.work-sat').forEach((sat) => {
      const open = sat.querySelector('details.is-open, details[open].is-open')
      sat.classList.toggle('is-focus', !!open)
    })
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
    if (empty) empty.hidden = visible > 0
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      applyFilter(chip.dataset.filter)
    })
  })
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
  const win = window.open(url, '_blank')
  if (win) {
    win.opener = null
    return
  }
  window.location.href = url
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
setupReveal()
setupRowReveal()
setupLedger()
setupFilter()
setupContactForm()
setupMobileNav()
