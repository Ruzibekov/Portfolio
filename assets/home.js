// Mark JS active so CSS reveal applies (no-JS keeps everything visible).
document.documentElement.classList.add('js')

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

// Section reveal on scroll — cheap, transform/opacity only, native scroll.
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
    { threshold: 0, rootMargin: '0px 0px -12% 0px' },
  )
  targets.forEach((t) => observer.observe(t))
}

// Each ledger row reveals as it enters the viewport.
const setupRowReveal = () => {
  const rows = document.querySelectorAll('.work-ledger .work-row')
  if (!rows.length) return
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
    { threshold: 0, rootMargin: '0px 0px -8% 0px' },
  )
  rows.forEach((r) => observer.observe(r))
}

// Ledger rows: animated expand/collapse for <details> via grid-template-rows.
// The `toggle` listener also covers programmatic opens (find-in-page,
// text fragments) that set the open attribute without a click.
const setupLedger = () => {
  document.querySelectorAll('.work-row details').forEach((details) => {
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
      cancelPendingClose()
      details.open = true
      requestAnimationFrame(() => details.classList.add('is-open'))
    }

    const closeRow = () => {
      details.classList.remove('is-open')
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
      }
      onCloseEnd = finish
      expand.addEventListener('transitionend', finish)
      closeTimer = setTimeout(finish, 450)
    }

    summary.addEventListener('click', (event) => {
      if (reducedMotionQuery.matches) return
      event.preventDefault()
      if (details.classList.contains('is-open')) closeRow()
      else openRow()
    })

    details.addEventListener('toggle', () => {
      if (details.open) {
        if (!details.classList.contains('is-open')) {
          requestAnimationFrame(() => details.classList.add('is-open'))
        }
      } else {
        details.classList.remove('is-open')
        cancelPendingClose()
      }
    })
  })
}

const setupFilter = () => {
  const chips = document.querySelectorAll('.filter-chip')
  const rows = document.querySelectorAll('#workGrid .work-row')
  const empty = document.querySelector('#workEmpty')
  if (!chips.length || !rows.length) return

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter
      chips.forEach((other) => {
        const active = other === chip
        other.classList.toggle('is-active', active)
        other.setAttribute('aria-pressed', active ? 'true' : 'false')
      })
      let visible = 0
      rows.forEach((row) => {
        const categories = (row.dataset.category || '').split(' ')
        const show = filter === 'all' || categories.includes(filter)
        row.classList.toggle('is-hidden', !show)
        if (show) {
          row.classList.add('is-shown')
          visible += 1
        }
      })
      if (empty) empty.hidden = visible > 0
    })
  })
}

// Rail: highlight the section currently in view.
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

// Footer clock — Tashkent local time, updated every 30s.
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

// Mobile navigation: hamburger toggle with overlay panel, scrim/Esc close,
// scroll-lock, focus trap (toggle stays reachable above the overlay), a11y.
const setupMobileNav = () => {
  const toggle = document.querySelector('.nav-toggle')
  const menu = document.querySelector('.mobile-nav')
  if (!toggle || !menu) return
  const panel = menu.querySelector('.mobile-nav-panel')
  const firstLink = menu.querySelector('a')
  let lastFocused = null

  const open = () => {
    lastFocused = document.activeElement
    menu.hidden = false
    requestAnimationFrame(() => {
      menu.classList.add('is-open')
      document.body.classList.add('nav-open')
      toggle.setAttribute('aria-expanded', 'true')
      toggle.setAttribute('aria-label', 'Закрыть меню')
      if (firstLink) firstLink.focus({ preventScroll: true })
    })
  }

  const close = () => {
    menu.classList.remove('is-open')
    document.body.classList.remove('nav-open')
    toggle.setAttribute('aria-expanded', 'false')
    toggle.setAttribute('aria-label', 'Открыть меню')
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

setupReveal()
setupRowReveal()
setupLedger()
setupFilter()
setupRail()
setupClock()
setupMobileNav()
