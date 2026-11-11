;(() => {
  const hero = document.querySelector('[data-hero]')
  if (!hero) return
  const root = document.documentElement
  const track = hero.querySelector('[data-hero-track]')
  const stage = hero.querySelector('[data-hero-stage]')
  const hall = hero.querySelector('[data-hall]')
  const world = hero.querySelector('[data-world]')
  const floors = {
    d: hero.querySelector('.floor-d'),
    m: hero.querySelector('.floor-m'),
  }
  const floorSpecs = {}
  for (const [mode, svg] of Object.entries(floors)) {
    if (!svg) continue
    floorSpecs[mode] = {
      spec: JSON.parse(svg.dataset.floor),
      path: svg.querySelector('path'),
      drawn: '',
    }
  }
  const floorTravel = { d: [190, 420], m: [-150, 300] }
  const placardBox = hero.querySelector('[data-placards]')
  const minimap = hero.querySelector('[data-minimap]')
  const stepLabel = hero.querySelector('[data-minimap-step]')
  const steps = [...hero.querySelectorAll('.hero-step')]
  const allFigures = [...hero.querySelectorAll('.hero-slab')]
  const allPlacards = [...hero.querySelectorAll('.placard')]
  const allDots = [...hero.querySelectorAll('.minimap-dot')]
  const deskQuery = window.matchMedia(
    '(min-width: 1024px) and (min-height: 600px)',
  )
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)')

  const slots = {
    d: [
      [520, 20, 420, -30, 0],
      [165, 0, 0, -26, 0],
      [-110, 0, -700, -20, 0.3],
      [-330, 0, -1400, -16, 0.45],
      [-550, 0, -2200, -12, 0.6],
    ],
    dPhone: [
      [520, 20, 420, -30, 0],
      [165, 0, 0, -26, 0],
      [-240, 0, -700, -20, 0.3],
      [-500, 0, -1400, -16, 0.45],
      [-700, 0, -2200, -12, 0.6],
    ],
    m: [
      [-300, 10, 300, -6, 0],
      [-24, 0, 0, -16, 0],
      [120, 0, -560, -20, 0.32],
      [230, 0, -1150, -22, 0.5],
    ],
  }
  const frameWidth = { d: 1280, m: 390 }

  function floorPath(f, dx, dz) {
    const project = (x, z) => {
      const scale = f.p / (f.p - z)
      return [
        Math.round((f.ox + x * scale) * 10) / 10,
        Math.round((f.oy + f.y * scale) * 10) / 10,
      ]
    }
    const lines = []
    const shiftZ = ((dz % f.cell) + f.cell) % f.cell
    const shiftX = ((dx % f.cell) + f.cell) % f.cell
    for (let z = f.z0 + shiftZ; z <= f.z1; z += f.cell) {
      const [ax, ay] = project(f.x0, z)
      const [bx] = project(f.x1, z)
      if (ay <= f.h + 1) lines.push(`M${ax} ${ay}H${bx}`)
    }
    for (let x = f.x0 + shiftX; x <= f.x1; x += f.cell) {
      const [ax, ay] = project(x, f.z0)
      const [bx, by] = project(x, f.z1)
      lines.push(`M${ax} ${ay}L${bx} ${by}`)
    }
    return lines.join('')
  }

  function drawFloor(x) {
    const floor = floorSpecs[state.mode]
    if (!floor) return
    const [ax, az] = floorTravel[state.mode]
    const d = floorPath(
      floor.spec,
      Math.round(x * ax * 2) / 2,
      Math.round(x * az * 2) / 2,
    )
    if (d === floor.drawn) return
    floor.drawn = d
    floor.path.setAttribute('d', d)
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
  }
  const hover = new Map()

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const two = (value) => String(value).padStart(2, '0')
  const modeKey = () => (deskQuery.matches ? 'd' : 'm')
  const indexOf = (element) => Number(element.dataset[state.mode])

  function opacityAt(s) {
    const tail = state.mode === 'd' ? 2 : 1
    if (s < -1 || s > tail + 1) return 0
    if (s <= -0.4) return (s + 1) / 0.6
    if (s <= tail) return 1
    return tail + 1 - s
  }

  function poseAt(s, kind) {
    const rows =
      state.mode === 'd' && kind === 'phone' ? slots.dPhone : slots[state.mode]
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
    state.k =
      floors[state.mode].getBoundingClientRect().width /
        frameWidth[state.mode] || 1
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
    if (state.mode === 'd') return state.travel ? scrollUnit() : state.manual
    return clamp(scrollUnit() + state.offset, 0, state.count - 1)
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
    state.front = index
    state.figures.forEach((figure, i) => {
      const front = i === index
      figure.classList.toggle('is-front', front)
      if (front) figure.removeAttribute('aria-hidden')
      else figure.setAttribute('aria-hidden', 'true')
      const link = figure.querySelector('[data-slab-url]')
      if (link) {
        if (front) link.removeAttribute('tabindex')
        else link.setAttribute('tabindex', '-1')
      }
    })
    state.placards.forEach((placard, i) => {
      placard.classList.toggle('is-front', i === index)
    })
    state.dots.forEach((dot, i) => {
      if (i === index) dot.setAttribute('aria-current', 'step')
      else dot.removeAttribute('aria-current')
    })
    if (stepLabel)
      stepLabel.textContent = `${two(index + 1)} / ${two(state.count)}`
  }

  function render() {
    const k = state.k
    const x = state.x
    state.figures.forEach((figure, i) => {
      const s = i - x
      const opacity = opacityAt(s)
      const out = opacity <= 0.001 || s < -1.5 || s > 3.5
      figure.classList.toggle('is-out', out)
      if (out) return
      const [px, py, pz, ry, dim] = poseAt(s, figure.dataset.kind)
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
    drawFloor(x)
    setFront(clamp(Math.round(x), 0, state.count - 1))
  }

  function step(now) {
    state.running = false
    const dt = Math.min(0.05, Math.max(0, (now - state.last) / 1000))
    state.last = now
    state.target = computeTarget()
    let settled = true
    if (state.reduced) {
      state.x = state.target
      state.v = 0
      state.dolly = 0
      state.rx = 0
      state.ry = 0
    } else {
      const substeps = Math.max(1, Math.ceil(dt / (1 / 240)))
      const h = dt / substeps
      for (let i = 0; i < substeps; i += 1) {
        const a = stiffness * (state.target - state.x) - damping * state.v
        state.v += a * h
        state.x += state.v * h
        const b = stiffness * (0 - state.dolly) - damping * state.dollyV
        state.dollyV += b * h
        state.dolly += state.dollyV * h
      }
      if (
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
  }

  function goTo(index, focusDot) {
    const target = clamp(index, 0, state.count - 1)
    if (state.travel) {
      const anchor = steps[target]
      window.scrollTo({
        top: state.trackTop + (anchor ? anchor.offsetTop : 0),
        behavior: 'smooth',
      })
    } else if (state.reduced) {
      state.manual = target
      state.x = target
    } else if (state.mode === 'd') {
      state.manual = target
    } else {
      state.offset = target - scrollUnit()
    }
    request()
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

  hall.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || state.mode !== 'm') return
    state.drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: state.reduced ? state.manual : state.offset,
      active: false,
      time: event.timeStamp,
      last: event.clientX,
      velocity: 0,
    }
  })

  hall.addEventListener('pointermove', (event) => {
    const drag = state.drag
    if (!drag || drag.id !== event.pointerId) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.active) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return
      drag.active = true
    }
    const elapsed = Math.max(1, event.timeStamp - drag.time)
    drag.velocity = (-(event.clientX - drag.last) / 240 / elapsed) * 1000
    drag.time = event.timeStamp
    drag.last = event.clientX
    if (!state.reduced) {
      const base = scrollUnit()
      state.offset = clamp(drag.start - dx / 240, -base, state.count - 1 - base)
      request()
    }
  })

  const release = (event) => {
    const drag = state.drag
    if (!drag || drag.id !== event.pointerId) return
    state.drag = null
    if (!drag.active) return
    const dx = event.clientX - drag.x
    if (state.reduced) {
      if (Math.abs(dx) > 40) goTo(state.manual + (dx < 0 ? 1 : -1), false)
      return
    }
    const base = scrollUnit()
    const projected = clamp(
      base + state.offset + drag.velocity * 0.18,
      0,
      state.count - 1,
    )
    state.offset = Math.round(projected) - base
    state.v += drag.velocity * 0.5
    request()
  }
  hall.addEventListener('pointerup', release)
  hall.addEventListener('pointercancel', release)

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
