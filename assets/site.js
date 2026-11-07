;(() => {
  const root = document.documentElement
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const storageKey = 'sr-product-intelligence-theme'
  const qs = (selector, scope = document) => scope.querySelector(selector)
  const qsa = (selector, scope = document) => [
    ...scope.querySelectorAll(selector),
  ]

  const syncMotion = () => root.classList.toggle('rm', reduceQuery.matches)
  syncMotion()
  reduceQuery.addEventListener('change', syncMotion)
  const reduced = () => reduceQuery.matches

  const themeButton = qs('[data-theme-toggle]')
  const syncTheme = () => {
    const dark = root.dataset.theme === 'dark'
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(dark))
      themeButton.setAttribute(
        'aria-label',
        dark ? themeButton.dataset.lightAction : themeButton.dataset.darkAction,
      )
    }
    const themeColor = qs('meta[name="theme-color"]')
    if (themeColor)
      themeColor.setAttribute(
        'content',
        getComputedStyle(root).getPropertyValue('--s0').trim(),
      )
  }
  syncTheme()
  themeButton?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      root.dataset.storage = 'unavailable'
    }
    syncTheme()
  })

  const header = qs('[data-header]')
  const syncHeader = () => header?.classList.toggle('s', window.scrollY > 8)
  syncHeader()
  window.addEventListener('scroll', syncHeader, { passive: true })

  const menuButton = qs('[data-menu-toggle]')
  const menu = qs('[data-mobile-menu]')
  const setMenu = (open, restoreFocus = false) => {
    if (!menuButton || !menu) return
    menu.classList.toggle('o', open)
    menuButton.setAttribute('aria-expanded', String(open))
    menuButton.setAttribute(
      'aria-label',
      open ? menuButton.dataset.closeLabel : menuButton.dataset.menuLabel,
    )
    if (restoreFocus) menuButton.focus()
  }
  menuButton?.addEventListener('click', () =>
    setMenu(menuButton.getAttribute('aria-expanded') !== 'true'),
  )
  menu?.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a'))
      setMenu(false)
  })

  const picker = qs('[data-language-picker]')
  document.addEventListener('click', (event) => {
    if (picker?.open && !picker.contains(event.target)) picker.open = false
  })

  const reveal = qsa('[data-r]')
  if ('IntersectionObserver' in window && !reduced()) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    )
    reveal.forEach((element) => observer.observe(element))
  } else reveal.forEach((element) => element.classList.add('in'))

  const build = qs('[data-build]')
  if (build) {
    const title = qs('[data-build-title]')
    const words = qsa('.wd', title)
    const steps = qsa('.bs', build)
    const image = qs('[data-build-image]', build)
    const measure = () =>
      build.style.setProperty('--bw', `${image.offsetWidth}px`)
    measure()
    window.addEventListener('resize', measure)
    const paint = (stage, final) => {
      build.dataset.st = String(stage)
      const mark = (list) =>
        list.forEach((item, index) => {
          item.classList.toggle('on', final || index < stage - 1)
          item.classList.toggle('cur', !final && index === stage - 1)
        })
      mark(words)
      mark(steps)
    }
    if (reduced()) paint(3, true)
    else {
      paint(1, false)
      window.setTimeout(() => paint(2, false), 1000)
      window.setTimeout(() => paint(3, true), 2500)
    }
  }

  const index = qs('[data-index]')
  if (!index) return
  const items = qsa('.row-item', index)
  const tabsRoot = qs('[data-tabs]')
  const tabs = qsa('[data-filter]', tabsRoot)
  const pill = qs('.pill', tabsRoot)
  const more = qs('[data-more]', index)
  const status = qs('[data-filter-status]')
  const limit = Number(index.dataset.limit || 0)
  let filter = 'all'
  let expanded = false

  const movePill = () => {
    const active = tabs.find(
      (tab) => tab.getAttribute('aria-pressed') === 'true',
    )
    if (!active || !pill) return
    pill.style.setProperty('--x', `${active.offsetLeft}px`)
    pill.style.setProperty('--w', `${active.offsetWidth}px`)
  }

  const render = () => {
    let shown = 0
    let total = 0
    let order = 0
    for (const item of items) {
      const match =
        filter === 'all' || item.dataset.category.split(' ').includes(filter)
      if (match) total += 1
      const show = match && (!limit || expanded || shown < limit)
      item.classList.remove('in')
      item.hidden = !show
      if (!show) continue
      shown += 1
      item.style.setProperty('--i', String(Math.min(order, 10)))
      order += 1
      void item.offsetWidth
      if (!reduced()) item.classList.add('in')
      qs('.num', item).textContent = String(shown).padStart(2, '0')
    }
    if (more) more.hidden = !limit || expanded || total <= limit
    if (status)
      status.textContent = status.dataset.template.replace(
        '{count}',
        String(total),
      )
  }

  tabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      filter = tab.dataset.filter
      expanded = false
      tabs.forEach((other) =>
        other.setAttribute('aria-pressed', String(other === tab)),
      )
      movePill()
      render()
    }),
  )
  qs('[data-show-more]', index)?.addEventListener('click', () => {
    expanded = true
    render()
  })
  movePill()
  document.fonts?.ready.then(movePill)
  window.addEventListener('resize', movePill)
  render()

  const preview = qs('[data-pv]')
  const sheet = qs('[data-sheet]')
  const scrim = qs('[data-scrim]')
  const sheetBody = qs('[data-sheet-body]', sheet)
  const sheetTag = qs('[data-sheet-tag]', sheet)
  const closeButton = qs('[data-sheet-close]', sheet)
  const inertTargets = [
    qs('.top'),
    qs('[data-mobile-menu]'),
    qs('main'),
    qs('#contact'),
    qs('.foot'),
  ]
  let lastRow = null

  if (preview && window.matchMedia('(hover: hover)').matches && !reduced()) {
    const frame = qs('.pv-f', preview)
    const image = qs('img', preview)
    const caption = qs('[data-preview-caption]', preview)
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let frameId = 0
    let active = false
    const step = () => {
      currentX += (targetX - currentX) * 0.18
      currentY += (targetY - currentY) * 0.18
      const tilt = Math.max(-6, Math.min(6, (targetX - currentX) * 0.12))
      preview.style.transform = `translate3d(${currentX}px,${currentY}px,0)`
      frame.style.setProperty('--rot', `${tilt.toFixed(2)}deg`)
      frameId =
        active ||
        Math.abs(targetX - currentX) > 0.5 ||
        Math.abs(targetY - currentY) > 0.5
          ? requestAnimationFrame(step)
          : 0
    }
    const hide = () => {
      active = false
      preview.classList.remove('on')
    }
    index.addEventListener('pointermove', (event) => {
      const item =
        event.target instanceof Element
          ? event.target.closest('.row-item')
          : null
      if (!item || item.hidden || sheet.classList.contains('o')) return hide()
      if (image.dataset.src !== item.dataset.preview) {
        image.dataset.src = item.dataset.preview
        image.src = item.dataset.preview
      }
      caption.textContent = item.dataset.tag
      const width = 380
      const height = 290
      let x = event.clientX + 28
      if (x + width > window.innerWidth - 16) x = event.clientX - width - 28
      const y = Math.max(
        76,
        Math.min(window.innerHeight - height - 16, event.clientY - height / 2),
      )
      targetX = x
      targetY = y
      if (!active) {
        currentX = x
        currentY = y
        active = true
        preview.classList.add('on')
      }
      if (!frameId) frameId = requestAnimationFrame(step)
    })
    index.addEventListener('pointerleave', hide)
  }

  const setInert = (value) =>
    inertTargets.forEach((target) => {
      if (target) target.inert = value
    })

  const open = (item) => {
    const detail = qs('[data-row-detail]', item)
    if (!detail) return
    lastRow = qs('.row', item)
    sheetBody.innerHTML = detail.innerHTML
    const heading = qs('h3', sheetBody)
    if (heading) heading.id = 'sheet-title'
    sheetTag.textContent = item.dataset.tag
    sheetBody.scrollTop = 0
    sheet.style.transform = ''
    setInert(true)
    sheet.classList.add('o')
    scrim.classList.add('o')
    sheet.setAttribute('aria-hidden', 'false')
    document.body.classList.add('lock')
    preview?.classList.remove('on')
    closeButton.focus({ preventScroll: true })
  }

  const close = () => {
    if (!sheet.classList.contains('o')) return
    sheet.classList.remove('o', 'drag')
    scrim.classList.remove('o')
    sheet.setAttribute('aria-hidden', 'true')
    sheet.style.transform = ''
    document.body.classList.remove('lock')
    setInert(false)
    lastRow?.focus({ preventScroll: true })
  }

  items.forEach((item) =>
    qs('.row', item).addEventListener('click', () => open(item)),
  )
  closeButton.addEventListener('click', close)
  scrim.addEventListener('click', close)
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (sheet.classList.contains('o')) close()
    else {
      if (picker?.open) {
        picker.open = false
        qs('summary', picker)?.focus()
      }
      if (menu?.classList.contains('o')) setMenu(false, true)
    }
  })

  let startY = 0
  let startTime = 0
  let offset = 0
  let dragging = false
  sheet.addEventListener('pointerdown', (event) => {
    if (window.innerWidth > 760) return
    if (
      !(event.target instanceof Element) ||
      !event.target.closest('.grab,.sh-top')
    )
      return
    if (event.target.closest('.sh-x')) return
    dragging = true
    startY = event.clientY
    startTime = event.timeStamp
    sheet.classList.add('drag')
    sheet.setPointerCapture(event.pointerId)
  })
  sheet.addEventListener('pointermove', (event) => {
    if (!dragging) return
    offset = Math.max(0, event.clientY - startY)
    sheet.style.transform = `translateY(${offset}px)`
  })
  const release = (event) => {
    if (!dragging) return
    dragging = false
    sheet.classList.remove('drag')
    const velocity = offset / Math.max(1, event.timeStamp - startTime)
    if (offset > 120 || velocity > 0.6) close()
    else sheet.style.transform = ''
    offset = 0
  }
  sheet.addEventListener('pointerup', release)
  sheet.addEventListener('pointercancel', release)
})()
