;(() => {
  const root = document.documentElement
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const compact = window.matchMedia('(max-width: 800px)')
  const wheelTau = 1000 / (0.085 * 60)
  const scrubTau = 90
  const anchorDuration = 1800

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
  const damp = (from, to, tau, dt) =>
    from + (to - from) * (1 - Math.exp(-dt / tau))
  const expoOut = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
  const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight)
  const motionAllowed = () => !reduce.matches
  const heroSnapping = () => root.classList.contains('snap-hero')

  const createScroller = () => {
    const state = {
      target: 0,
      current: 0,
      written: 0,
      last: 0,
      frame: 0,
      glide: null,
    }
    const releaseSnap = () => root.style.removeProperty('scroll-snap-type')
    const stop = () => {
      cancelAnimationFrame(state.frame)
      state.frame = 0
      state.glide = null
      releaseSnap()
    }
    const write = (y) => {
      state.written = Math.round(clamp(y, 0, maxScroll()))
      window.scrollTo({ top: state.written, behavior: 'instant' })
    }
    const step = (now) => {
      if (Math.abs(window.scrollY - state.written) > 1) return stop()
      if (!state.glide && heroSnapping()) return stop()
      const dt = clamp(now - state.last, 0, 50)
      state.last = now
      if (state.glide) {
        const { from, to, start, duration } = state.glide
        const t = clamp((now - start) / duration)
        state.current = from + (to - from) * expoOut(t)
        if (t === 1) {
          state.glide = null
          state.current = state.target = to
        }
      } else {
        state.current = damp(state.current, state.target, wheelTau, dt)
        if (Math.abs(state.target - state.current) < 0.5)
          state.current = state.target
      }
      write(state.current)
      const settled = state.current === state.target && !state.glide
      state.frame = settled ? 0 : requestAnimationFrame(step)
      if (settled) releaseSnap()
    }
    const begin = () => {
      if (state.frame) return
      state.current = state.target = state.written = window.scrollY
      state.last = performance.now()
      state.frame = requestAnimationFrame(step)
    }
    return {
      stop,
      wheel(delta) {
        begin()
        state.glide = null
        state.target = clamp(state.target + delta, 0, maxScroll())
      },
      glide(to) {
        begin()
        root.style.setProperty('scroll-snap-type', 'none')
        const destination = clamp(to, 0, maxScroll())
        state.glide = {
          from: state.current,
          to: destination,
          start: performance.now(),
          duration: anchorDuration,
        }
        state.target = destination
      },
    }
  }

  const canScrollInside = (node, deltaY) => {
    for (
      let element = node instanceof Element ? node : null;
      element && element !== document.body && element !== root;
      element = element.parentElement
    ) {
      if (element.scrollHeight <= element.clientHeight + 1) continue
      if (!/auto|scroll/.test(getComputedStyle(element).overflowY)) continue
      const room =
        deltaY > 0
          ? element.scrollTop + element.clientHeight < element.scrollHeight - 1
          : element.scrollTop > 0
      if (room) return true
    }
    return false
  }

  const wheelDelta = (event) => {
    if (event.deltaMode === 1) return event.deltaY * 16
    if (event.deltaMode === 2) return event.deltaY * window.innerHeight
    return event.deltaY
  }

  const normalizePath = (path) => path.replace(/\/+$/, '') || '/'

  const anchorTarget = (link) => {
    const url = new URL(link.href, window.location.href)
    if (
      !url.hash ||
      url.origin !== window.location.origin ||
      normalizePath(url.pathname) !== normalizePath(window.location.pathname)
    )
      return null
    const id = decodeURIComponent(url.hash.slice(1))
    const element = id ? document.getElementById(id) : null
    return element ? { element, hash: url.hash } : null
  }

  const focusAfterGlide = (element) => {
    if (element === document.body) return
    if (!element.matches('a[href], button, input, select, textarea, summary'))
      element.setAttribute('tabindex', '-1')
    element.focus({ preventScroll: true })
  }

  const setupSmoothScroll = () => {
    const scroller = createScroller()
    window.addEventListener(
      'wheel',
      (event) => {
        if (
          !motionAllowed() ||
          !finePointer.matches ||
          event.ctrlKey ||
          event.defaultPrevented ||
          !event.cancelable ||
          document.body.classList.contains('is-locked') ||
          heroSnapping() ||
          Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
          canScrollInside(event.target, event.deltaY)
        )
          return
        event.preventDefault()
        scroller.wheel(wheelDelta(event))
      },
      { passive: false },
    )
    document.addEventListener('click', (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !motionAllowed()
      )
        return
      const link =
        event.target instanceof Element
          ? event.target.closest('a[href*="#"]:not(.skip-link)')
          : null
      if (!link) return
      const target = anchorTarget(link)
      if (!target) return
      event.preventDefault()
      const padding = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0
      const top =
        target.element === document.body
          ? 0
          : target.element.getBoundingClientRect().top +
            window.scrollY -
            padding
      scroller.glide(top)
      if (window.location.hash !== target.hash)
        history.pushState(null, '', target.hash)
      focusAfterGlide(target.element)
    })
    reduce.addEventListener('change', () => scroller.stop())
  }

  const createScrubLoop = () => {
    const scrubbers = []
    let frame = 0
    let last = 0
    const tick = (now) => {
      const dt = clamp(now - last, 0, 50)
      last = now
      const targets = scrubbers.map((scrubber) =>
        scrubber.active() ? scrubber.measure() : null,
      )
      let moving = false
      scrubbers.forEach((scrubber, index) => {
        const target = targets[index]
        if (target === null) {
          if (scrubber.value !== null) scrubber.reset()
          scrubber.value = null
          return
        }
        const next =
          scrubber.value === null
            ? target
            : damp(scrubber.value, target, scrubTau, dt)
        scrubber.value = Math.abs(next - target) < 0.0005 ? target : next
        if (scrubber.value !== target) moving = true
        scrubber.apply(scrubber.value)
      })
      frame = moving ? requestAnimationFrame(tick) : 0
    }
    const request = () => {
      if (frame) return
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    reduce.addEventListener('change', request)
    compact.addEventListener('change', request)
    return {
      add(scrubber) {
        scrubbers.push({ value: null, ...scrubber })
        request()
      },
    }
  }

  const layoutTop = (element, anchor) => {
    const anchorTop = anchor.getBoundingClientRect().top
    const offset =
      element.offsetParent === anchor
        ? element.offsetTop
        : element.offsetTop - anchor.offsetTop
    return anchorTop + offset
  }

  const setupStageScrub = (loop) => {
    document
      .querySelectorAll('.showroom-home [data-stage]')
      .forEach((stage) => {
        const anchor = stage.parentElement
        const world = stage.querySelector('[data-stage-world]')
        if (!anchor) return
        let unfoldStyle = ''
        let driftStyle = ''
        loop.add({
          active: motionAllowed,
          measure: () => {
            const top = layoutTop(stage, anchor)
            const height = stage.offsetHeight
            const viewport = window.innerHeight
            return clamp((viewport - top) / (viewport + height))
          },
          apply: (progress) => {
            const viewport = window.innerHeight
            const height = stage.offsetHeight
            const top = viewport - progress * (viewport + height)
            const unfold = clamp((viewport * 0.85 - top) / (viewport * 0.4))
            const depth = Math.max(900, height * 4)
            const nextUnfold = `perspective(${depth}px) rotateX(${(24 * (1 - unfold)).toFixed(2)}deg) scale(${(0.96 + 0.04 * unfold).toFixed(4)})`
            if (nextUnfold !== unfoldStyle) {
              unfoldStyle = nextUnfold
              stage.style.transform = nextUnfold
            }
            if (!world) return
            const nextDrift = `0 ${((progress - 0.5) * height * -0.07).toFixed(2)}px`
            if (nextDrift !== driftStyle) {
              driftStyle = nextDrift
              world.style.translate = nextDrift
            }
          },
          reset: () => {
            unfoldStyle = driftStyle = ''
            stage.style.removeProperty('transform')
            world?.style.removeProperty('translate')
          },
        })
      })
  }

  const setupHeroScrub = (loop) => {
    const copy = document.querySelector('.hero-copy')
    if (!copy) return
    const masks = [...copy.querySelectorAll('.rise-mask')]
    const lines = [
      ...copy.querySelectorAll('.hero-name, .hero-lead, .stats, .cta-row'),
    ]
    loop.add({
      active: () => motionAllowed() && compact.matches,
      measure: () => {
        const rect = copy.getBoundingClientRect()
        return clamp(-rect.top / Math.max(1, rect.height))
      },
      apply: (progress) => {
        const opacity = (1 - progress).toFixed(3)
        masks.forEach((mask, index) => {
          mask.style.translate = `0 ${(-(30 + 7 * index) * progress).toFixed(2)}%`
          mask.style.opacity = opacity
        })
        lines.forEach((line) => {
          line.style.translate = `0 ${(-60 * progress).toFixed(1)}px`
          line.style.opacity = opacity
        })
      },
      reset: () => {
        ;[...masks, ...lines].forEach((element) => {
          element.style.removeProperty('translate')
          element.style.removeProperty('opacity')
        })
      },
    })
  }

  const setupProgress = () => {
    const bar = document.createElement('div')
    bar.className = 'scroll-progress'
    bar.setAttribute('aria-hidden', 'true')
    document.body.append(bar)
    let frame = 0
    const update = () => {
      frame = 0
      const max = maxScroll()
      const progress = max > 0 ? clamp(window.scrollY / max) : 0
      bar.style.transform = `scaleX(${progress.toFixed(4)})`
      bar.classList.toggle('is-visible', window.scrollY > 40)
    }
    const request = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    update()
  }

  const maskHeadingLines = (heading) => {
    const lines = [[]]
    ;[...heading.childNodes].forEach((node) => {
      if (node.nodeName === 'BR') lines.push([])
      else lines[lines.length - 1].push(node)
    })
    heading.replaceChildren()
    lines.forEach((nodes, index) => {
      if (index) heading.append(document.createElement('br'))
      const mask = document.createElement('span')
      mask.className = 'line-mask'
      const inner = document.createElement('span')
      inner.className = 'line-inner'
      inner.style.setProperty('--i', String(index))
      inner.append(...nodes)
      mask.append(inner)
      heading.append(mask)
    })
  }

  const revealBlocks = [
    '.sec-intro',
    '.showroom-title .eyebrow',
    '.svc-list > li',
    '.showroom-home .sr-info',
    '.showroom-home .sr-panel',
    '.process-step',
    '.about-copy .me',
    '.about-text',
    '.about-statement',
    '.stack-panel',
    '.faq-item',
    '.contact-copy .lead',
    '.contact-strap',
    '.contact-slab',
  ].join(', ')

  const setupReveals = () => {
    if (!('IntersectionObserver' in window)) return
    const fold = window.innerHeight * 0.92
    const below = (element) => element.getBoundingClientRect().top > fold
    const headings = [...document.querySelectorAll('.sec h2.h2')].filter(
      (heading) => !heading.querySelector('a, button') && below(heading),
    )
    headings.forEach((heading) => {
      maskHeadingLines(heading)
      heading.dataset.reveal = 'lines'
    })
    const blocks = [...document.querySelectorAll(revealBlocks)].filter(below)
    blocks.forEach((block) => {
      block.dataset.reveal = 'rise'
    })
    const pending = [...headings, ...blocks]
    if (!pending.length) return
    pending.forEach((element) => element.classList.add('reveal-pending'))
    const show = (element, delay) => {
      element.style.setProperty('--d', `${delay}ms`)
      element.classList.remove('reveal-pending')
      element.classList.add('is-revealed')
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          .forEach((entry, index) => {
            observer.unobserve(entry.target)
            show(entry.target, Math.min(index, 5) * 80)
          })
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    pending.forEach((element) => observer.observe(element))
    document.addEventListener('focusin', (event) => {
      const element =
        event.target instanceof Element
          ? event.target.closest('.reveal-pending')
          : null
      if (!element) return
      observer.unobserve(element)
      show(element, 0)
    })
    reduce.addEventListener('change', () => {
      if (!reduce.matches) return
      observer.disconnect()
      document
        .querySelectorAll('.reveal-pending')
        .forEach((element) => show(element, 0))
    })
  }

  const interactiveSelector = [
    'a[href]',
    'button',
    'summary',
    'label',
    '[role="button"]',
    '.hero-slab',
    '.sr-slab[data-slot="-1"]',
    '.sr-slab[data-slot="1"]',
  ].join(', ')
  const labelTarget = (target) => {
    const element = target.closest('[data-cursor]')
    if (!element || element.closest('.is-dragging')) return null
    if (element.matches('.hero-slab:not(.is-front)')) return null
    return element
  }

  const setupCursor = () => {
    const ring = document.createElement('div')
    ring.className = 'cursor-ring'
    ring.setAttribute('aria-hidden', 'true')
    const shape = document.createElement('span')
    shape.className = 'cursor-shape'
    ring.append(shape)
    const dot = document.createElement('div')
    dot.className = 'cursor-dot'
    dot.setAttribute('aria-hidden', 'true')
    document.body.append(ring, dot)
    root.classList.add('has-cursor')

    const pointer = { x: -100, y: -100 }
    const trail = { x: -100, y: -100 }
    let squeeze = 1
    let squeezeTarget = 1
    let magnet = null
    let frame = 0
    let last = 0
    let stale = false
    let visible = false

    const releaseMagnet = () => {
      if (magnet) magnet.style.removeProperty('translate')
      magnet = null
    }
    const describe = (target) => {
      if (!(target instanceof Element)) return
      const label = labelTarget(target)?.dataset.cursor ?? ''
      ring.classList.toggle('is-label', Boolean(label))
      if (label) shape.dataset.label = label
      ring.classList.toggle(
        'is-hover',
        !label && Boolean(target.closest(interactiveSelector)),
      )
    }
    const attract = (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest('[data-magnetic]')
          : null
      if (target !== magnet) releaseMagnet()
      if (!target) return
      magnet = target
      const rect = target.getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      target.style.translate = `${(dx * 0.28).toFixed(1)}px ${(dy * 0.38).toFixed(1)}px`
    }
    const render = (now) => {
      const dt = clamp(now - last, 0, 50)
      last = now
      if (stale) {
        stale = false
        describe(document.elementFromPoint(pointer.x, pointer.y))
      }
      const dx = pointer.x - trail.x
      const dy = pointer.y - trail.y
      trail.x = damp(trail.x, pointer.x, 95, dt)
      trail.y = damp(trail.y, pointer.y, 95, dt)
      squeeze = damp(squeeze, squeezeTarget, 58, dt)
      const calm =
        ring.classList.contains('is-label') ||
        ring.classList.contains('is-hover')
      const stretch = calm ? 0 : Math.min(Math.hypot(dx, dy) / 140, 0.5)
      const angle = Math.atan2(dy, dx)
      dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`
      ring.style.transform = `translate3d(${trail.x.toFixed(2)}px, ${trail.y.toFixed(2)}px, 0) rotate(${angle.toFixed(3)}rad) scale(${((1 + stretch) * squeeze).toFixed(3)}, ${((1 - 0.55 * stretch) * squeeze).toFixed(3)}) rotate(${(-angle).toFixed(3)}rad)`
      const settled =
        Math.abs(dx) < 0.1 &&
        Math.abs(dy) < 0.1 &&
        Math.abs(squeeze - squeezeTarget) < 0.001
      frame = settled ? 0 : requestAnimationFrame(render)
    }
    const wake = () => {
      if (frame) return
      last = performance.now()
      frame = requestAnimationFrame(render)
    }

    window.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse') return
        pointer.x = event.clientX
        pointer.y = event.clientY
        if (!visible) {
          visible = true
          trail.x = pointer.x
          trail.y = pointer.y
          root.classList.add('cursor-visible')
        }
        describe(event.target)
        attract(event)
        wake()
      },
      { passive: true },
    )
    window.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse') return
      squeezeTarget = 0.78
      wake()
    })
    window.addEventListener('pointerup', () => {
      squeezeTarget = 1
      wake()
    })
    window.addEventListener(
      'scroll',
      () => {
        if (!visible) return
        stale = true
        releaseMagnet()
        wake()
      },
      { passive: true },
    )
    document.documentElement.addEventListener('mouseleave', () => {
      visible = false
      root.classList.remove('cursor-visible')
      releaseMagnet()
    })
    reduce.addEventListener('change', () => {
      if (!reduce.matches) return
      releaseMagnet()
      cancelAnimationFrame(frame)
      frame = 0
      ring.remove()
      dot.remove()
      root.classList.remove('has-cursor', 'cursor-visible')
    })
  }

  const markMagnetic = () => {
    document
      .querySelectorAll('.hero .cta-row .btn, .btn-nav, .theme-toggle, .to-top')
      .forEach((element) => {
        element.dataset.magnetic = ''
      })
  }

  setupProgress()
  if (!motionAllowed()) return
  const loop = createScrubLoop()
  setupSmoothScroll()
  setupStageScrub(loop)
  setupHeroScrub(loop)
  setupReveals()
  if (finePointer.matches) {
    markMagnetic()
    setupCursor()
  }
})()
