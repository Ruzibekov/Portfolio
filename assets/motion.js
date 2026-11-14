;(() => {
  const root = document.documentElement
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const compact = window.matchMedia('(max-width: 800px)')
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
  const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight)
  const motionAllowed = () => !reduce.matches

  const createScrubLoop = () => {
    const scrubbers = []
    let frame = 0
    const tick = () => {
      frame = 0
      const targets = scrubbers.map((scrubber) =>
        scrubber.active() ? scrubber.measure() : null,
      )
      scrubbers.forEach((scrubber, index) => {
        const target = targets[index]
        if (target === null) {
          if (scrubber.value !== null) scrubber.reset()
          scrubber.value = null
          return
        }
        if (scrubber.value === target) return
        scrubber.value = target
        scrubber.apply(target)
      })
    }
    const request = () => {
      if (!frame) frame = requestAnimationFrame(tick)
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
    let magnet = null
    let frame = 0
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
        motionAllowed() && event.target instanceof Element
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
    const render = () => {
      frame = 0
      if (stale) {
        stale = false
        describe(document.elementFromPoint(pointer.x, pointer.y))
      }
      const position = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`
      dot.style.transform = position
      ring.style.transform = position
    }
    const request = () => {
      if (!frame) frame = requestAnimationFrame(render)
    }

    window.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse') return
        pointer.x = event.clientX
        pointer.y = event.clientY
        if (!visible) {
          visible = true
          root.classList.add('cursor-visible')
        }
        describe(event.target)
        attract(event)
        request()
      },
      { passive: true },
    )
    window.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse') return
      ring.classList.add('is-pressed')
    })
    window.addEventListener('pointerup', () => {
      ring.classList.remove('is-pressed')
    })
    window.addEventListener(
      'scroll',
      () => {
        if (!visible) return
        stale = true
        releaseMagnet()
        request()
      },
      { passive: true },
    )
    root.addEventListener('mouseleave', () => {
      visible = false
      root.classList.remove('cursor-visible')
      ring.classList.remove('is-pressed')
      releaseMagnet()
    })
    reduce.addEventListener('change', releaseMagnet)
  }

  const markMagnetic = () => {
    document
      .querySelectorAll('.hero .cta-row .btn, .btn-nav, .theme-toggle, .to-top')
      .forEach((element) => {
        element.dataset.magnetic = ''
      })
  }

  setupProgress()
  if (finePointer.matches) setupCursor()
  if (!motionAllowed()) return
  const loop = createScrubLoop()
  setupStageScrub(loop)
  setupHeroScrub(loop)
  setupReveals()
  if (finePointer.matches) markMagnetic()
})()
