// Mark JS active so CSS reveal applies (no-JS keeps everything visible).
document.documentElement.classList.add('js')

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Section reveal on scroll — cheap, transform/opacity only, native scroll.
const setupReveal = () => {
  const targets = document.querySelectorAll('.reveal')
  if (reducedMotion) {
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

// Each work card reveals as it enters the viewport, cascading left-to-right per row.
const setupCardReveal = () => {
  const cards = document.querySelectorAll('.work-grid .work-card')
  if (!cards.length) return
  if (reducedMotion) {
    cards.forEach((c) => c.classList.add('is-shown'))
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
    { threshold: 0, rootMargin: '0px 0px -10% 0px' },
  )
  cards.forEach((c) => observer.observe(c))
}

const setupFilter = () => {
  const chips = document.querySelectorAll('.filter-chip')
  const cards = document.querySelectorAll('#workGrid .work-card')
  const empty = document.querySelector('#workEmpty')
  if (!chips.length || !cards.length) return

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter
      chips.forEach((other) => {
        const active = other === chip
        other.classList.toggle('is-active', active)
        other.setAttribute('aria-selected', active ? 'true' : 'false')
      })
      let visible = 0
      cards.forEach((card) => {
        const categories = (card.dataset.category || '').split(' ')
        const show = filter === 'all' || categories.includes(filter)
        card.classList.toggle('is-hidden', !show)
        if (show) {
          card.classList.add('is-shown')
          visible += 1
        }
      })
      if (empty) empty.hidden = visible > 0
    })
  })
}

// Proof numbers — set to their final value (no count-up gimmick).
const setupCounters = () => {
  document.querySelectorAll('[data-count]').forEach((el) => {
    el.textContent = el.dataset.count + (el.dataset.suffix || '')
  })
}

// Mobile navigation: hamburger toggle with overlay panel, scrim/Esc close,
// scroll-lock, focus trap, a11y.
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
    const finish = () => {
      menu.hidden = true
      panel.removeEventListener('transitionend', finish)
    }
    panel.addEventListener('transitionend', finish)
    setTimeout(() => {
      if (!menu.classList.contains('is-open')) menu.hidden = true
    }, 500)
    if (lastFocused) lastFocused.focus({ preventScroll: true })
  }

  toggle.addEventListener('click', () => {
    if (menu.classList.contains('is-open')) close()
    else open()
  })
  menu.querySelectorAll('[data-nav-close]').forEach((el) => el.addEventListener('click', close))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) close()
  })
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !menu.classList.contains('is-open')) return
    const focusable = panel.querySelectorAll('a, button')
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
  window.matchMedia('(min-width: 1081px)').addEventListener('change', (event) => {
    if (event.matches && menu.classList.contains('is-open')) close()
  })
}

setupReveal()
setupCardReveal()
setupFilter()
setupCounters()
setupMobileNav()
