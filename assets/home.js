// Mark JS as active so CSS can apply reveal animations (no-JS keeps content visible).
document.documentElement.classList.add('js')

const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches

class PhysicsField {
  constructor(canvas) {
    this.canvas = canvas
    this.context = canvas.getContext('2d')
    this.nodes = []
    this.pointer = { x: -9999, y: -9999, active: false }
    this.frame = 0
    this.resize = this.resize.bind(this)
    this.move = this.move.bind(this)
    this.leave = this.leave.bind(this)
    this.tick = this.tick.bind(this)
    window.addEventListener('resize', this.resize)
    window.addEventListener('pointermove', this.move, { passive: true })
    window.addEventListener('pointerleave', this.leave)
    this.resize()
    this.tick()
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = Math.floor(this.width * ratio)
    this.canvas.height = Math.floor(this.height * ratio)
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0)
    this.createNodes()
  }

  createNodes() {
    const target = Math.max(28, Math.min(72, Math.floor(this.width / 22)))
    this.nodes = Array.from({ length: target }, (_, index) => {
      const lane = index / target
      const x = 40 + Math.random() * (this.width - 80)
      const y = 40 + Math.random() * (this.height - 80)
      return {
        x,
        y,
        homeX: x,
        homeY: y + Math.sin(lane * Math.PI * 4) * 34,
        vx: 0,
        vy: 0,
        mass: 0.75 + Math.random() * 1.4,
        hue: index % 3,
      }
    })
  }

  move(event) {
    this.pointer.x = event.clientX
    this.pointer.y = event.clientY
    this.pointer.active = true
  }

  leave() {
    this.pointer.active = false
    this.pointer.x = -9999
    this.pointer.y = -9999
  }

  tick() {
    this.frame += 1
    this.update()
    this.draw()
    requestAnimationFrame(this.tick)
  }

  update() {
    for (const node of this.nodes) {
      const driftX = Math.sin(this.frame * 0.008 + node.homeY * 0.02) * 24
      const driftY = Math.cos(this.frame * 0.006 + node.homeX * 0.015) * 16
      const targetX = node.homeX + driftX
      const targetY = node.homeY + driftY
      node.vx += ((targetX - node.x) * 0.012) / node.mass
      node.vy += ((targetY - node.y) * 0.012) / node.mass
      const dx = node.x - this.pointer.x
      const dy = node.y - this.pointer.y
      const dist = Math.hypot(dx, dy)
      if (this.pointer.active && dist < 170) {
        const force = (170 - dist) / 170
        const angle = Math.atan2(dy, dx)
        node.vx += Math.cos(angle) * force * 2.8
        node.vy += Math.sin(angle) * force * 2.8
      }
      node.vx *= 0.9
      node.vy *= 0.9
      node.x += node.vx
      node.y += node.vy
    }
  }

  draw() {
    const ctx = this.context
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.lineWidth = 1
    for (let i = 0; i < this.nodes.length; i += 1) {
      const current = this.nodes[i]
      for (let j = i + 1; j < this.nodes.length; j += 1) {
        const next = this.nodes[j]
        const dist = Math.hypot(current.x - next.x, current.y - next.y)
        if (dist < 130) {
          const alpha = (1 - dist / 130) * 0.2
          ctx.strokeStyle = `rgba(143, 183, 232, ${alpha * 0.56})`
          ctx.beginPath()
          ctx.moveTo(current.x, current.y)
          ctx.lineTo(next.x, next.y)
          ctx.stroke()
        }
      }
    }
    for (const node of this.nodes) {
      const color =
        node.hue === 0
          ? '143, 183, 232'
          : node.hue === 1
            ? '199, 169, 109'
            : '185, 120, 102'
      ctx.fillStyle = `rgba(${color}, 0.46)`
      ctx.beginPath()
      ctx.arc(node.x, node.y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

const setupReveal = () => {
  const targets = document.querySelectorAll('.reveal')
  // threshold:0 + bottom rootMargin reveals as soon as the section's top edge
  // enters the viewport — robust for sections taller than the screen (mobile),
  // where a percentage threshold would never be reached.
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0, rootMargin: '0px 0px -12% 0px' },
  )
  targets.forEach((target) => observer.observe(target))
}

const setupMagnetic = () => {
  document.querySelectorAll('.magnetic').forEach((element) => {
    element.addEventListener('pointermove', (event) => {
      const rect = element.getBoundingClientRect()
      const x = event.clientX - rect.left - rect.width / 2
      const y = event.clientY - rect.top - rect.height / 2
      element.style.transform = `translate(${x * 0.14}px, ${y * 0.18}px)`
    })
    element.addEventListener('pointerleave', () => {
      element.style.transform = 'translate(0, 0)'
    })
  })
}

const setupTilt = () => {
  // Tilt only on the hero stage; work cards use a lighter hover-lift (CSS).
  document.querySelectorAll('.hero-stage[data-tilt]').forEach((element) => {
    element.addEventListener('pointermove', (event) => {
      const rect = element.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width - 0.5
      const y = (event.clientY - rect.top) / rect.height - 0.5
      element.style.transform = `rotateX(${y * -8}deg) rotateY(${x * 10}deg) translateY(-2px)`
    })
    element.addEventListener('pointerleave', () => {
      element.style.transform = 'rotateX(0) rotateY(0) translateY(0)'
    })
  })
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
        if (show) visible += 1
      })

      if (empty) empty.hidden = visible > 0
    })
  })
}

setupReveal()
setupFilter()

if (!reducedMotion) {
  const field = document.querySelector('#field')
  if (field) {
    new PhysicsField(field)
  }
  setupMagnetic()
  setupTilt()
} else {
  document
    .querySelectorAll('.reveal')
    .forEach((target) => target.classList.add('is-visible'))
}
