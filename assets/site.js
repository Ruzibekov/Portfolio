;(() => {
  const root = document.documentElement
  const themeButton = document.querySelector('[data-theme-toggle]')
  const menuButton = document.querySelector('[data-menu-toggle]')
  const menu = document.querySelector('[data-mobile-menu]')
  const languagePicker = document.querySelector('.language-picker')
  const filters = [...document.querySelectorAll('[data-filter]')]
  const workGrid = document.querySelector('[data-work-grid]')
  const filterStatus = document.querySelector('[data-filter-status]')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const animations = new Set()
  const storageKey = 'sr-product-intelligence-theme'

  const syncTheme = () => {
    if (!(themeButton instanceof HTMLButtonElement)) return
    const dark = root.dataset.theme === 'dark'
    themeButton.setAttribute('aria-pressed', String(dark))
    themeButton.setAttribute(
      'aria-label',
      dark ? themeButton.dataset.lightAction : themeButton.dataset.darkAction,
    )
    const themeColor = document.querySelector('meta[name="theme-color"]')
    if (themeColor)
      themeColor.setAttribute(
        'content',
        getComputedStyle(root).getPropertyValue('--canvas').trim(),
      )
  }

  const closeMenu = (restoreFocus = false) => {
    if (
      !(menu instanceof HTMLElement) ||
      !(menuButton instanceof HTMLButtonElement)
    )
      return
    menu.hidden = true
    menuButton.setAttribute('aria-expanded', 'false')
    menuButton.textContent = menuButton.dataset.menuLabel
    if (restoreFocus) menuButton.focus()
  }

  const animateCard = (element, frames) => {
    if (reduce.matches) return
    const animation = element.animate(frames, {
      duration: 250,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    })
    animations.add(animation)
    const clear = () => animations.delete(animation)
    animation.addEventListener('finish', clear, { once: true })
    animation.addEventListener('cancel', clear, { once: true })
  }

  themeButton?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(storageKey, root.dataset.theme)
    } catch {
      root.dataset.storage = 'unavailable'
    }
    syncTheme()
  })

  menuButton?.addEventListener('click', () => {
    if (
      !(menu instanceof HTMLElement) ||
      !(menuButton instanceof HTMLButtonElement)
    )
      return
    const open = menuButton.getAttribute('aria-expanded') !== 'true'
    menu.hidden = !open
    menuButton.setAttribute('aria-expanded', String(open))
    menuButton.textContent = open
      ? menuButton.dataset.closeLabel
      : menuButton.dataset.menuLabel
  })
  menu
    ?.querySelectorAll('a')
    .forEach((link) => link.addEventListener('click', () => closeMenu()))
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (menuButton?.getAttribute('aria-expanded') === 'true') closeMenu(true)
    if (languagePicker?.open) {
      languagePicker.open = false
      languagePicker.querySelector('summary')?.focus()
    }
  })
  document.addEventListener('pointerdown', (event) => {
    if (languagePicker?.open && !languagePicker.contains(event.target))
      languagePicker.open = false
    if (
      menuButton?.getAttribute('aria-expanded') === 'true' &&
      !menuButton.contains(event.target) &&
      !menu?.contains(event.target)
    )
      closeMenu()
  })
  window
    .matchMedia('(min-width: 901px)')
    .addEventListener('change', (event) => {
      if (event.matches) closeMenu()
    })

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      if (!(workGrid instanceof HTMLElement)) return
      const filter = button.dataset.filter
      if (!['all', 'web', 'mobile', 'ai'].includes(filter)) return
      animations.forEach((animation) => animation.cancel())
      animations.clear()
      const cards = [...workGrid.querySelectorAll('[data-category]')]
      const before = new Map(
        cards
          .filter((card) => !card.hidden)
          .map((card) => [card, card.getBoundingClientRect()]),
      )
      let visible = 0
      cards.forEach((card) => {
        const show =
          filter === 'all' || card.dataset.category.split(' ').includes(filter)
        card.hidden = !show
        if (show) visible += 1
      })
      workGrid.dataset.activeFilter = filter
      filters.forEach((item) =>
        item.setAttribute('aria-pressed', String(item === button)),
      )
      if (filterStatus instanceof HTMLElement)
        filterStatus.textContent = filterStatus.dataset.template.replace(
          '{count}',
          String(visible),
        )
      cards
        .filter((card) => !card.hidden)
        .forEach((card) => {
          const old = before.get(card)
          const next = card.getBoundingClientRect()
          if (old)
            animateCard(card, [
              {
                transform: `translate(${old.x - next.x}px, ${old.y - next.y}px)`,
              },
              { transform: 'translate(0, 0)' },
            ])
          else
            animateCard(card, [
              { transform: 'translateY(8px)', opacity: 0.8 },
              { transform: 'translateY(0)', opacity: 1 },
            ])
        })
    })
  })

  reduce.addEventListener('change', () => {
    if (!reduce.matches) return
    animations.forEach((animation) => animation.cancel())
    animations.clear()
  })
  syncTheme()
})()
