;(() => {
  const root = document.documentElement
  const storageKey = 'sr-product-intelligence-theme'
  const vtKey = 'sr-vt-slab'
  const qs = (selector, scope = document) => scope.querySelector(selector)
  const qsa = (selector, scope = document) => [
    ...scope.querySelectorAll(selector),
  ]

  root.classList.add('img-fade')
  const fail = (screen) => {
    if (!screen) return
    screen.classList.add('is-failed')
    const phone = screen.closest('.trio-phone')
    const trio = phone?.closest('.slab-trio')
    if (!trio) return
    if (phone.classList.contains('trio-side')) {
      phone.classList.add('is-dropped')
    } else {
      const spare = trio.querySelector(':scope > .trio-side:not(.is-dropped)')
      const backup = spare?.querySelector('[data-screen]')
      if (backup) {
        phone.insertBefore(backup, screen)
        spare.prepend(screen)
        spare.classList.add('is-dropped')
      }
    }
    trio.dataset.screens = String(
      trio.querySelectorAll(':scope > .trio-phone:not(.is-dropped)').length,
    )
  }
  const markImage = (image) => {
    const screen = image.closest('[data-screen]')
    if (image.complete && image.naturalWidth > 0) {
      image.classList.add('is-loaded')
      screen?.classList.remove('is-failed')
    } else if (image.complete) {
      fail(screen)
    }
  }
  qsa('img[data-slab-img]').forEach(markImage)
  document.addEventListener(
    'load',
    (event) => {
      if (event.target.matches?.('img[data-slab-img]')) markImage(event.target)
    },
    true,
  )
  document.addEventListener(
    'error',
    (event) => {
      if (event.target.matches?.('img[data-slab-img]'))
        fail(event.target.closest('[data-screen]'))
    },
    true,
  )

  const themeButton = qs('[data-theme-toggle]')
  const themeColor = qs('meta[name="theme-color"]')
  const syncTheme = () => {
    const dark = root.dataset.theme !== 'light'
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(dark))
      themeButton.setAttribute(
        'aria-label',
        dark ? themeButton.dataset.lightAction : themeButton.dataset.darkAction,
      )
    }
    const color = themeColor?.dataset[dark ? 'dark' : 'light']
    if (color) themeColor.setAttribute('content', color)
  }
  syncTheme()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const toggleTheme = () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light'
    root.dataset.theme = next
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      root.dataset.storage = 'unavailable'
    }
    syncTheme()
  }
  const themeOrigin = (event) => {
    if (event.detail > 0) return { x: event.clientX, y: event.clientY }
    const rect = themeButton.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }
  themeButton?.addEventListener('click', (event) => {
    if (
      reduceMotion.matches ||
      typeof document.startViewTransition !== 'function'
    ) {
      toggleTheme()
      return
    }
    const { x, y } = themeOrigin(event)
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )
    const clearWipe = () => root.classList.remove('theme-wipe')
    root.classList.add('theme-wipe')
    const transition = document.startViewTransition(toggleTheme)
    transition.finished.then(clearWipe, clearWipe)
    transition.ready
      .then(() =>
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 700,
            easing: 'cubic-bezier(0.76, 0, 0.24, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        ),
      )
      .catch(clearWipe)
  })

  const header = qs('[data-header]')
  let solid = null
  const syncHeader = () => {
    const next = window.scrollY > 8
    if (next !== solid) {
      solid = next
      header?.classList.toggle('is-solid', next)
    }
  }
  syncHeader()
  window.addEventListener('scroll', syncHeader, { passive: true })

  const navCta = qs('[data-nav-cta]')
  const primaries = qsa('[data-primary-cta]')
  if (navCta && 'IntersectionObserver' in window) {
    const seen = new Set()
    const ctaObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) seen.add(entry.target)
        else seen.delete(entry.target)
      }
      navCta.classList.toggle('is-accent', seen.size === 0)
    })
    primaries.forEach((element) => ctaObserver.observe(element))
    if (!primaries.length) navCta.classList.add('is-accent')
  }

  const navLinks = qsa('[data-nav-link]')
  const sections = navLinks
    .map((link) => document.getElementById(link.dataset.navLink))
    .filter(Boolean)
  if (sections.length && 'IntersectionObserver' in window) {
    const active = new Set()
    const syncCurrent = () => {
      const current = sections.find((section) => active.has(section))
      navLinks.forEach((link) => {
        if (current && link.dataset.navLink === current.id)
          link.setAttribute('aria-current', 'true')
        else link.removeAttribute('aria-current')
      })
    }
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) active.add(entry.target)
          else active.delete(entry.target)
        }
        syncCurrent()
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    sections.forEach((section) => sectionObserver.observe(section))
  }

  const menuButton = qs('[data-menu-toggle]')
  const menu = qs('[data-mobile-menu]')
  const menuScrim = qs('[data-menu-scrim]')
  const menuFocusables = () =>
    [menuButton, ...qsa('a[href], button:not([disabled])', menu)].filter(
      Boolean,
    )
  const setMenu = (open, restoreFocus) => {
    if (!menu || !menuButton) return
    menu.classList.toggle('is-open', open)
    menuScrim?.classList.toggle('is-open', open)
    header?.classList.toggle('is-menu-open', open)
    document.body.classList.toggle('is-locked', open)
    menuButton.setAttribute('aria-expanded', String(open))
    menuButton.setAttribute(
      'aria-label',
      open ? menuButton.dataset.closeLabel : menuButton.dataset.menuLabel,
    )
    if (open) {
      menu.removeAttribute('inert')
      qs('a[href]', menu)?.focus({ preventScroll: true })
    } else {
      menu.setAttribute('inert', '')
      if (restoreFocus) menuButton.focus({ preventScroll: true })
    }
  }
  const menuOpen = () => menu?.classList.contains('is-open')
  menuButton?.addEventListener('click', () => setMenu(!menuOpen(), true))
  menuScrim?.addEventListener('click', () => setMenu(false, true))
  menu?.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) setMenu(false, false)
  })
  document.addEventListener('keydown', (event) => {
    if (!menuOpen()) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setMenu(false, true)
      return
    }
    if (event.key !== 'Tab') return
    const list = menuFocusables()
    const index = list.indexOf(document.activeElement)
    if (event.shiftKey && index <= 0) {
      event.preventDefault()
      list[list.length - 1].focus()
    } else if (!event.shiftKey && index === list.length - 1) {
      event.preventDefault()
      list[0].focus()
    } else if (index < 0) {
      event.preventDefault()
      list[0].focus()
    }
  })
  window
    .matchMedia('(min-width: 1100px)')
    .addEventListener('change', (event) => {
      if (event.matches && menuOpen()) setMenu(false, false)
    })

  const picker = qs('[data-language-picker]')
  if (picker) {
    const summary = qs('summary', picker)
    picker.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && picker.open) {
        event.preventDefault()
        picker.open = false
        summary?.focus()
      }
    })
    document.addEventListener('click', (event) => {
      if (picker.open && !picker.contains(event.target)) picker.open = false
    })
    picker.addEventListener('focusout', (event) => {
      if (
        picker.open &&
        event.relatedTarget &&
        !picker.contains(event.relatedTarget)
      )
        picker.open = false
    })
  }

  const clearNames = () => {
    qsa('[data-vt-named]').forEach((element) => {
      element.style.viewTransitionName = ''
      element.removeAttribute('data-vt-named')
    })
  }
  const nameElement = (element, key) => {
    clearNames()
    element.style.viewTransitionName = `slab-${key}`
    element.setAttribute('data-vt-named', '')
  }
  const returnKey = (path) => `${vtKey}:${path}`
  document.addEventListener('vt:name', (event) => {
    const { element, key, source } = event.detail
    if (!element || !key || !('startViewTransition' in document)) return
    nameElement(element, key)
    try {
      sessionStorage.setItem(
        returnKey(location.pathname),
        JSON.stringify({ key, source }),
      )
    } catch {
      root.dataset.storage = 'unavailable'
    }
  })
  const restoreName = () => {
    let saved = null
    try {
      saved = JSON.parse(
        sessionStorage.getItem(returnKey(location.pathname)) ?? 'null',
      )
    } catch {
      root.dataset.storage = 'unavailable'
    }
    if (!saved?.key) return
    const key = CSS.escape(saved.key)
    const selector =
      saved.source === 'hero'
        ? `.hero-slab.is-front[data-key="${key}"]`
        : `.sr-slab[data-slot="0"][data-key="${key}"]`
    const element = qs(selector)
    if (element) nameElement(element, saved.key)
  }
  window.addEventListener('pageswap', (event) => {
    const transition = event.viewTransition
    if (!transition) return
    transition.ready.then(null, clearNames)
    transition.finished.then(clearNames, clearNames)
  })
  window.addEventListener('pagereveal', (event) => {
    if (!event.viewTransition) {
      clearNames()
      return
    }
    restoreName()
    event.viewTransition.ready.then(null, clearNames)
    event.viewTransition.finished.then(clearNames, clearNames)
  })
})()
