;(() => {
  const hero = document.querySelector('[data-hero]')
  if (!hero) return
  const root = document.documentElement
  const track = hero.querySelector('[data-hero-track]')
  const stage = hero.querySelector('[data-hero-stage]')
  const hall = hero.querySelector('[data-hall]')
  const world = hero.querySelector('[data-world]')
  const placardBox = hero.querySelector('[data-placards]')
  const minimap = hero.querySelector('[data-minimap]')
  const stepLabel = hero.querySelector('[data-minimap-step]')
  const steps = [...hero.querySelectorAll('.hero-step')]
  const allFigures = [...hero.querySelectorAll('.hero-slab')]
  const allPlacards = [...hero.querySelectorAll('.placard')]
  const allDots = [...hero.querySelectorAll('.minimap-dot')]
  const navButtons = [...hero.querySelectorAll('[data-hero-step]')]
  const live = hero.querySelector('[data-hero-live]')
  const deskQuery = window.matchMedia(
    '(min-width: 1024px) and (min-height: 600px)',
  )
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)')

  const slots = {
    d: [
      [60, 10, -220, 28, 0],
      [20, 0, 0, 22, 0],
      [270, 0, -700, 20, 0.3],
      [440, 0, -1400, 16, 0.45],
      [570, 0, -2200, 12, 0.6],
    ],
    dPhone: [
      [60, 10, -220, 28, 0],
      [20, 0, 0, 22, 0],
      [330, 0, -700, 20, 0.3],
      [520, 0, -1400, 16, 0.45],
      [670, 0, -2200, 12, 0.6],
    ],
    m: [
      [-330, 10, 300, 6, 0],
      [-24, 0, 0, 16, 0],
      [345, 0, -300, 24, 0.3],
      [520, 0, -900, 24, 0.5],
    ],
    mPhone: [
      [-330, 10, 300, 6, 0],
      [-24, 0, 0, 16, 0],
      [293, 0, -300, 24, 0.3],
      [440, 0, -900, 24, 0.5],
    ],
  }
  const stiffness = 170
  const damping = 26

  const state = {
    mode: 'd',
    figures: [],
    placards: [],
    dots: [],
    count: 0,
    k: 1,
    travel: false,
    reduced: reduceQuery.matches,
    x: 0,
    v: 0,
    target: 0,
    manual: 0,
    offset: 0,
    dolly: 0,
    dollyV: 0,
    rx: 0,
    ry: 0,
    prx: 0,
    pry: 0,
    front: -1,
    inView: true,
    trackTop: 0,
    trackHeight: 0,
    hallTop: 0,
    hallHeight: 0,
    viewport: window.innerHeight,
    snap: false,
    running: false,
    last: 0,
    drag: null,
    pending: -1,
    suppress: false,
  }
  const hover = new Map()

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const modeKey = () => (deskQuery.matches ? 'd' : 'm')
  const indexOf = (element) => Number(element.dataset[state.mode])

  function opacityAt(s) {
    const tail = state.mode === 'd' ? 2 : 1
    if (s <= -0.25 || s >= tail + 0.5) return 0
    if (s < 0) return 1 + 4 * s
    if (s <= tail) return 1
    return (tail + 0.5 - s) * 2
  }

  function poseAt(s, kind) {
    const narrow = kind === 'phone' || kind === 'trio'
    const rows =
      state.mode === 'd'
        ? narrow
          ? slots.dPhone
          : slots.d
        : narrow
          ? slots.mPhone
          : slots.m
    const position = clamp(s + 1, 0, rows.length - 1)
    const low = Math.floor(position)
    const high = Math.min(rows.length - 1, low + 1)
    const t = position - low
    return rows[low].map(
      (value, index) => value + (rows[high][index] - value) * t,
    )
  }

  function measure() {
    const rect = track.getBoundingClientRect()
    state.trackTop = rect.top + window.scrollY
    state.trackHeight = track.offsetHeight
    const hallRect = hall.getBoundingClientRect()
    state.hallTop = hallRect.top + window.scrollY
    state.hallHeight = hall.offsetHeight
    state.viewport = window.innerHeight
    const probe = state.figures[0]
    const units = probe
      ? parseFloat(getComputedStyle(probe).getPropertyValue('--sw'))
      : 0
    state.k = probe && units ? probe.offsetWidth / units || 1 : 1
  }

  function scrollUnit() {
    const y = window.scrollY
    if (state.mode === 'd') {
      const range = state.trackHeight - state.viewport
      if (range <= 0) return 0
      return clamp((y - state.trackTop) / range, 0, 1) * (state.count - 1)
    }
    const top = state.hallTop - y
    const start = Math.min(0.55 * state.viewport, state.hallTop)
    const p = clamp((start - top) / Math.max(1, start - 64), 0, 1)
    const raw = p * (state.count - 1)
    const whole = Math.floor(raw)
    const part = clamp((raw - whole - 0.3) / 0.4, 0, 1)
    return Math.min(state.count - 1, whole + part * part * (3 - 2 * part))
  }

  function computeTarget() {
    if (state.reduced) return state.manual
    if (state.mode === 'd' && !state.travel) return state.manual
    const raw = scrollUnit() + state.offset
    return state.drag?.active ? raw : clamp(raw, 0, state.count - 1)
  }

  function band(raw) {
    const max = state.count - 1
    if (raw < 0) return -Math.min(0.5, -raw * 0.35)
    if (raw > max) return max + Math.min(0.5, (raw - max) * 0.35)
    return raw
  }

  function announce(index) {
    const placard = state.placards[index]
    if (!live || !placard) return
    const parts = [
      `${index + 1} / ${state.count}`,
      placard.querySelector('.placard-title')?.textContent,
      ...[...placard.querySelectorAll('.placard-meta > span')].map(
        (part) => part.textContent,
      ),
      ...[...placard.querySelectorAll('.status')].flatMap((status) =>
        status.classList.contains('status-stores')
          ? [...status.children].map((store) => store.textContent)
          : [status.textContent],
      ),
    ]
    live.textContent = parts
      .map((part) => (part || '').trim())
      .filter(Boolean)
      .join('. ')
  }

  function syncSnap() {
    const on =
      state.travel &&
      window.scrollY < state.trackTop + state.trackHeight - state.viewport * 0.6
    if (on !== state.snap) {
      state.snap = on
      root.classList.toggle('snap-hero', on)
    }
  }

  function setFront(index) {
    if (index === state.front) return
    const active = document.activeElement
    const held =
      active && active !== hall && state.figures[state.front]?.contains(active)
    state.front = index
    state.figures.forEach((figure, i) => {
      const front = i === index
      figure.classList.toggle('is-front', front)
      if (front) figure.removeAttribute('aria-hidden')
      else figure.setAttribute('aria-hidden', 'true')
      const link = figure.querySelector('[data-slab-url]')
      if (link) {
        const bar = link.closest('.slab-bar')
        if (front) {
          link.removeAttribute('tabindex')
          bar?.removeAttribute('aria-hidden')
        } else {
          link.setAttribute('tabindex', '-1')
          bar?.setAttribute('aria-hidden', 'true')
        }
      }
    })
    state.placards.forEach((placard, i) => {
      placard.classList.toggle('is-front', i === index)
    })
    state.dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute('aria-current', 'step')
      else dot.removeAttribute('aria-current')
      dot.tabIndex = i === index ? 0 : -1
    })
    if (stepLabel) stepLabel.textContent = `${index + 1} / ${state.count}`
    navButtons.forEach((button) => {
      const edge = Number(button.dataset.heroStep) < 0 ? 0 : state.count - 1
      if (index === edge) button.setAttribute('aria-disabled', 'true')
      else button.removeAttribute('aria-disabled')
    })
    if (held) {
      const link = state.figures[index]?.querySelector('[data-slab-url]')
      ;(link || hall).focus({ preventScroll: true })
    }
    if (state.pending === index) {
      state.pending = -1
      announce(index)
    }
  }

  function render() {
    const k = state.k
    const x = state.x
    const trio = state.figures.reduce(
      (most, figure, i) =>
        figure.classList.contains('slab-trio')
          ? Math.max(most, clamp(1 - Math.abs(i - x) * 2, 0, 1))
          : most,
      0,
    )
    state.figures.forEach((figure, i) => {
      const s = i - x
      const own = figure.classList.contains('slab-trio')
        ? clamp(1 - Math.abs(s) * 2, 0, 1)
        : 0
      const reach = state.mode === 'd' ? 1 : clamp(2 - 2 * Math.abs(s), 0, 1)
      const opacity = opacityAt(s) * (1 - Math.max(0, trio - own) * reach)
      const out = opacity <= 0.001 && !figure.contains(document.activeElement)
      figure.classList.toggle('is-out', out)
      if (out) return
      const [px, py, pz, ry, dim] = poseAt(
        s,
        figure.classList.contains('slab-trio') ? 'trio' : figure.dataset.kind,
      )
      const h = hover.get(figure) ?? 0
      const front = Math.abs(s) < 0.5
      const lift = front ? 32 * h : 0
      figure.style.transform = `translate3d(${(px * k).toFixed(2)}px, ${(py * k).toFixed(2)}px, ${((pz + lift) * k).toFixed(2)}px) rotateY(${ry.toFixed(3)}deg)`
      figure.style.opacity = opacity >= 0.999 ? '' : opacity.toFixed(3)
      const shade = figure.querySelector('[data-dim]')
      if (shade) shade.style.opacity = Math.max(0, dim - 0.12 * h).toFixed(3)
    })
    const camera =
      state.dolly || state.rx || state.ry
        ? `translateZ(${(state.dolly * k).toFixed(2)}px) rotateX(${state.rx.toFixed(3)}deg) rotateY(${state.ry.toFixed(3)}deg)`
        : ''
    world.style.transform = camera
    setFront(clamp(Math.floor(x + 0.75), 0, state.count - 1))
  }

  function step(now) {
    state.running = false
    const dt = Math.min(0.05, Math.max(0, (now - state.last) / 1000))
    state.last = now
    state.target = computeTarget()
    let settled = true
    if (state.drag?.active && !state.reduced) {
      state.x = state.target
      state.v = state.drag.velocity
    }
    if (state.reduced) {
      state.x = state.target
      state.v = 0
      state.dolly = 0
      state.rx = 0
      state.ry = 0
    } else {
      const substeps = Math.max(1, Math.ceil(dt / (1 / 240)))
      const h = dt / substeps
      const follow = Boolean(state.drag?.active)
      for (let i = 0; i < substeps; i += 1) {
        if (!follow) {
          const a = stiffness * (state.target - state.x) - damping * state.v
          state.v += a * h
          state.x += state.v * h
        }
        const b = stiffness * (0 - state.dolly) - damping * state.dollyV
        state.dollyV += b * h
        state.dolly += state.dollyV * h
      }
      if (follow) settled = false
      else if (
        Math.abs(state.target - state.x) < 0.001 &&
        Math.abs(state.v) < 0.001
      ) {
        state.x = state.target
        state.v = 0
      } else settled = false
      if (Math.abs(state.dolly) < 0.05 && Math.abs(state.dollyV) < 0.05) {
        state.dolly = 0
        state.dollyV = 0
      } else settled = false
      state.rx += (state.prx - state.rx) * 0.12
      state.ry += (state.pry - state.ry) * 0.12
      if (
        Math.abs(state.prx - state.rx) < 0.002 &&
        Math.abs(state.pry - state.ry) < 0.002
      ) {
        state.rx = state.prx
        state.ry = state.pry
      } else settled = false
      for (const [figure, value] of hover) {
        const goal = figure.matches(':hover') ? 1 : 0
        const next = value + (goal - value) * 0.18
        if (Math.abs(goal - next) < 0.005) {
          if (goal === 0) hover.delete(figure)
          else hover.set(figure, 1)
        } else {
          hover.set(figure, next)
          settled = false
        }
      }
    }
    render()
    if (!settled || state.drag) request()
  }

  function request() {
    if (
      state.running ||
      !state.inView ||
      document.visibilityState !== 'visible'
    )
      return
    state.running = true
    requestAnimationFrame((now) => {
      if (!state.last || now - state.last > 100) state.last = now - 16
      step(now)
    })
  }

  function setup() {
    const active = document.activeElement
    const heldPlacard = allPlacards.some((placard) => placard.contains(active))
    const held =
      heldPlacard ||
      (active !== hall && allFigures.some((figure) => figure.contains(active)))
    state.mode = modeKey()
    state.reduced = reduceQuery.matches
    state.travel = state.mode === 'd' && !state.reduced
    root.classList.add('scene-live')
    root.classList.toggle('scene-travel', state.travel)
    if (!state.travel && state.snap) {
      state.snap = false
      root.classList.remove('snap-hero')
    }
    const pick = (list) =>
      list
        .filter((element) => Number(element.dataset[state.mode]) >= 0)
        .sort((a, b) => indexOf(a) - indexOf(b))
    state.figures = pick(allFigures)
    state.placards = pick(allPlacards)
    state.dots = pick(allDots)
    state.count = state.figures.length
    const rail = minimap?.querySelector('.minimap-rail')
    state.dots.forEach((dot, i) => {
      dot.setAttribute('aria-label', `${i + 1}. ${dot.dataset.title}`)
      rail?.append(dot)
    })
    allDots.forEach((dot) => {
      if (!state.dots.includes(dot)) rail?.append(dot)
    })
    allFigures.forEach((figure) => {
      if (!state.figures.includes(figure)) {
        figure.classList.add('is-out')
        figure.classList.remove('is-front')
        figure.setAttribute('aria-hidden', 'true')
        figure.style.transform = ''
        figure.style.opacity = ''
      }
    })
    allPlacards.forEach((placard) => {
      if (!state.placards.includes(placard))
        placard.classList.remove('is-front')
    })
    state.front = -1
    state.manual = clamp(Math.round(state.x), 0, state.count - 1)
    state.offset = 0
    measure()
    state.target = computeTarget()
    state.x = state.target
    state.v = 0
    state.prx = 0
    state.pry = 0
    syncSnap()
    render()
    if (held) {
      const target = heldPlacard
        ? state.placards[state.front]
        : state.figures[state.front]?.querySelector('[data-slab-url]')
      ;(target || hall).focus({ preventScroll: true })
    }
  }

  function commit(index, from = state.front) {
    const target = clamp(index, 0, state.count - 1)
    state.pending = target === from && target === state.front ? -1 : target
    if (state.pending >= 0 && state.pending === state.front) {
      state.pending = -1
      announce(target)
    }
    if (state.reduced || (state.mode === 'd' && !state.travel)) {
      state.manual = target
      if (state.reduced) {
        state.x = target
        state.v = 0
      }
    } else if (state.travel) {
      const anchor = steps[target]
      window.scrollTo({
        top: state.trackTop + (anchor ? anchor.offsetTop : 0),
        behavior: 'instant',
      })
      state.offset = 0
    } else {
      state.offset = target - scrollUnit()
    }
    request()
    return target
  }

  function goal() {
    return clamp(Math.round(computeTarget()), 0, state.count - 1)
  }

  function goTo(index, focusDot) {
    const target = commit(index, goal())
    if (focusDot) state.dots[target]?.focus()
  }

  minimap?.removeAttribute('hidden')
  minimap?.addEventListener('click', (event) => {
    const dot = event.target.closest('.minimap-dot')
    if (!dot || !state.dots.includes(dot)) return
    goTo(state.dots.indexOf(dot), false)
  })
  minimap?.addEventListener('keydown', (event) => {
    const dot = event.target.closest('.minimap-dot')
    if (!dot) return
    const current = state.dots.indexOf(dot)
    const keys = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: state.count - 1,
    }
    if (!(event.key in keys)) return
    event.preventDefault()
    goTo(keys[event.key], true)
  })

  minimap?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-hero-step]')
    if (!button || button.getAttribute('aria-disabled') === 'true') return
    goTo(goal() + Number(button.dataset.heroStep), false)
  })

  hall.addEventListener(
    'click',
    (event) => {
      if (!state.suppress || event.detail === 0) return
      state.suppress = false
      event.preventDefault()
      event.stopPropagation()
    },
    true,
  )

  hall.addEventListener('dragstart', (event) => event.preventDefault())

  hall.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const keys = {
      ArrowLeft: goal() - 1,
      ArrowRight: goal() + 1,
      Home: 0,
      End: state.count - 1,
    }
    if (!(event.key in keys)) return
    event.preventDefault()
    goTo(keys[event.key], false)
  })

  let wheelTimer = 0
  let wheelLocked = false
  stage.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) return
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      if (Math.abs(event.deltaX) < 2) return
      event.preventDefault()
      window.clearTimeout(wheelTimer)
      wheelTimer = window.setTimeout(() => {
        wheelLocked = false
      }, 320)
      if (wheelLocked || state.drag?.active) return
      wheelLocked = true
      goTo(goal() + Math.sign(event.deltaX), false)
    },
    { passive: false },
  )

  hall.addEventListener('click', (event) => {
    if (event.target.closest('a')) return
    const figure = event.target.closest('.hero-slab')
    const index = state.figures.indexOf(figure)
    if (index < 0) return
    if (index === state.front) state.placards[index]?.click()
    else goTo(index, false)
  })

  placardBox.addEventListener('click', (event) => {
    const placard = event.target.closest('.placard')
    if (!placard) return
    const key = placard.dataset.key
    if (placard.dataset.sheetKey && document.querySelector('[data-sheet]')) {
      event.preventDefault()
      document.dispatchEvent(
        new CustomEvent('sheet:open', { detail: { key, opener: placard } }),
      )
      return
    }
    const figure = state.figures[state.front]
    if (figure && figure.dataset.key === key)
      document.dispatchEvent(
        new CustomEvent('vt:name', {
          detail: { element: figure, key, source: 'hero' },
        }),
      )
  })

  hall.addEventListener('pointerover', (event) => {
    if (!fineQuery.matches || state.reduced) return
    const figure = event.target.closest('.hero-slab')
    if (!figure || hover.has(figure)) return
    hover.set(figure, 0)
    request()
  })

  hall.addEventListener('pointerout', () => {
    if (hover.size) request()
  })

  stage.addEventListener('pointermove', (event) => {
    if (!fineQuery.matches || state.reduced || state.mode !== 'd') return
    const rect = stage.getBoundingClientRect()
    const nx = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
    const ny = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1)
    state.pry = nx * 1.4
    state.prx = -ny * 0.9
    request()
  })

  stage.addEventListener('pointerleave', () => {
    state.prx = 0
    state.pry = 0
    request()
  })

  const unitsPerPixel = () => -1 / ((state.mode === 'd' ? 355 : 276) * state.k)

  const clearSuppress = () =>
    window.setTimeout(() => {
      state.suppress = false
    }, 0)

  hall.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return
    if (state.drag) cancel()
    state.suppress = false
    const moving =
      !state.reduced &&
      (Math.abs(state.target - state.x) > 0.01 || Math.abs(state.v) > 0.05)
    if (moving) {
      state.offset = state.x - scrollUnit()
      state.v = 0
      state.pending = -1
      state.suppress = true
    }
    state.drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: event.clientX,
      base: state.x,
      from: clamp(Math.round(state.x), 0, state.count - 1),
      caught: moving,
      active: false,
      samples: [],
      velocity: 0,
    }
    request()
  })

  window.addEventListener('pointermove', (event) => {
    const drag = state.drag
    if (!drag || drag.id !== event.pointerId) return
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      cancel()
      return
    }
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.active) {
      if (Math.abs(dy) >= 8 && Math.abs(dy) >= Math.abs(dx)) {
        state.drag = null
        if (drag.caught) commit(Math.round(state.x))
        return
      }
      if (Math.abs(dx) < 8) return
      drag.active = true
      drag.origin = event.clientX
      drag.base = state.x
      hall.classList.add('is-dragging')
      if (hall.hasPointerCapture && !hall.hasPointerCapture(event.pointerId))
        hall.setPointerCapture(event.pointerId)
    }
    event.preventDefault()
    const raw = drag.base + (event.clientX - drag.origin) * unitsPerPixel()
    drag.raw = raw
    drag.samples.push({ t: event.timeStamp, raw })
    while (drag.samples.length && event.timeStamp - drag.samples[0].t > 100)
      drag.samples.shift()
    const first = drag.samples[0]
    const span = event.timeStamp - first.t
    drag.velocity = span > 0 ? ((raw - first.raw) / span) * 1000 : 0
    if (!state.reduced) {
      state.offset = band(raw) - scrollUnit()
      request()
    }
  })

  const release = (event) => {
    const drag = state.drag
    if (!drag || (event && drag.id !== event.pointerId)) return
    state.drag = null
    hall.classList.remove('is-dragging')
    if (hall.hasPointerCapture?.(drag.id)) hall.releasePointerCapture(drag.id)
    const up = event?.type === 'pointerup'
    if (up && (drag.active || drag.caught)) {
      state.suppress = true
      clearSuppress()
    } else state.suppress = false
    if (!drag.active) {
      if (drag.caught) commit(Math.round(state.x))
      return
    }
    const last = drag.samples[drag.samples.length - 1]
    const fresh = up && last && event.timeStamp - last.t < 100
    const velocity = fresh ? drag.velocity : 0
    const raw = drag.raw ?? drag.base
    if (state.reduced) {
      const moved = raw - drag.base
      commit(
        Math.abs(moved) > 0.12 || Math.abs(velocity) > 0.9
          ? drag.from + Math.sign(moved || velocity)
          : drag.from,
        drag.from,
      )
      return
    }
    let next = clamp(
      Math.round(raw + velocity * 0.15),
      Math.floor(raw),
      Math.ceil(raw),
    )
    if (Math.abs(velocity) > 0.9 && next === drag.from)
      next = drag.from + Math.sign(velocity)
    state.x = band(raw)
    state.v = clamp(velocity, -6, 6)
    commit(next, drag.from)
  }
  const cancel = () => release(null)
  window.addEventListener('pointerup', release, true)
  window.addEventListener('pointercancel', release, true)
  hall.addEventListener('lostpointercapture', (event) => {
    if (event.target === hall) release(event)
  })
  hall.addEventListener('contextmenu', cancel)
  window.addEventListener('blur', cancel)

  let restTimer = 0
  const rest = () => {
    if (state.mode !== 'm' || state.reduced || state.drag) return
    const base = scrollUnit()
    const goal = clamp(Math.round(base + state.offset), 0, state.count - 1)
    if (Math.abs(goal - base - state.offset) < 0.001) return
    state.offset = goal - base
    request()
  }
  window.addEventListener(
    'scroll',
    () => {
      syncSnap()
      request()
      window.clearTimeout(restTimer)
      restTimer = window.setTimeout(rest, 160)
    },
    { passive: true },
  )

  const resize = new ResizeObserver(() => {
    measure()
    syncSnap()
    request()
  })
  resize.observe(track)
  resize.observe(document.body)

  const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) state.inView = entry.isIntersecting
    if (state.inView) request()
  })
  visibility.observe(hero)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      state.last = 0
      request()
    }
  })

  deskQuery.addEventListener('change', setup)
  reduceQuery.addEventListener('change', setup)

  setup()

  const heroVisible = hero.getBoundingClientRect().top < window.innerHeight
  if (!state.reduced && heroVisible && window.scrollY <= state.trackTop + 4) {
    state.dolly = -600
    state.dollyV = 0
    placardBox.classList.add('is-entering')
    const settle = (event) => {
      if (event.animationName !== 'placard-rise') return
      placardBox.classList.remove('is-entering')
      placardBox.removeEventListener('animationend', settle)
    }
    placardBox.addEventListener('animationend', settle)
    render()
  }
  request()

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return
    state.dolly = 0
    state.dollyV = 0
    placardBox.classList.remove('is-entering')
    measure()
    state.x = computeTarget()
    state.v = 0
    render()
  })
})()
