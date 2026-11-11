;(() => {
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const wideQuery = window.matchMedia('(min-width: 1024px)')
  const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  const reduced = () => reduceQuery.matches

  const sheet = document.querySelector('[data-sheet]')
  const scrim = document.querySelector('[data-scrim]')
  const sheetBody = sheet?.querySelector('[data-sheet-body]')
  const sheetTag = sheet?.querySelector('[data-sheet-tag]')
  const sheetClose = sheet?.querySelector('[data-sheet-close]')
  let sheetOpener = null

  function templatePart(item, name) {
    const template = item?.querySelector('template[data-row-template]')
    const part = template?.content.querySelector(`[data-part="${name}"]`)
    return part ? part.cloneNode(true) : null
  }

  function findItem(key) {
    return document.querySelector(`.sr-item[data-key="${CSS.escape(key)}"]`)
  }

  function focusables(scope) {
    return [
      ...scope.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter(
      (element) =>
        !element.closest('[hidden]') && element.getClientRects().length,
    )
  }

  function openSheet(key, opener) {
    const item = findItem(key)
    const part = templatePart(item, 'detail')
    if (!sheet || !part) return false
    sheetOpener = opener ?? document.activeElement
    sheetBody.replaceChildren(...part.childNodes)
    const type = item.querySelector('.sr-row-type')?.textContent ?? ''
    const number = item.dataset.number ?? ''
    sheetTag.textContent = [number, type].filter(Boolean).join(' · ')
    sheet.style.transform = ''
    sheet.removeAttribute('inert')
    sheet.classList.add('is-open')
    scrim?.classList.add('is-open')
    document.body.classList.add('is-locked')
    sheetBody.scrollTop = 0
    sheetClose?.focus({ preventScroll: true })
    return true
  }

  function closeSheet() {
    if (!sheet?.classList.contains('is-open')) return
    sheet.classList.remove('is-open', 'is-dragging')
    sheet.style.transform = ''
    sheet.setAttribute('inert', '')
    scrim?.classList.remove('is-open')
    document.body.classList.remove('is-locked')
    if (sheetOpener?.isConnected) sheetOpener.focus({ preventScroll: true })
    sheetOpener = null
  }

  if (sheet) {
    sheetClose?.addEventListener('click', closeSheet)
    scrim?.addEventListener('click', closeSheet)
    sheet.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSheet()
        return
      }
      if (event.key !== 'Tab') return
      const list = focusables(sheet)
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    })
    const handle = sheet.querySelector('.sheet-top')
    let drag = null
    handle?.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button') || wideQuery.matches) return
      drag = { id: event.pointerId, y: event.clientY, dy: 0 }
      handle.setPointerCapture(event.pointerId)
      sheet.classList.add('is-dragging')
    })
    handle?.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return
      drag.dy = Math.max(0, event.clientY - drag.y)
      sheet.style.transform = `translateY(${drag.dy}px)`
    })
    const endDrag = (event) => {
      if (!drag || drag.id !== event.pointerId) return
      const distance = drag.dy
      drag = null
      sheet.classList.remove('is-dragging')
      if (distance > 96) closeSheet()
      else sheet.style.transform = ''
    }
    handle?.addEventListener('pointerup', endDrag)
    handle?.addEventListener('pointercancel', endDrag)
    document.addEventListener('sheet:open', (event) => {
      openSheet(event.detail.key, event.detail.opener)
    })
  }

  function hashId() {
    const raw = location.hash.slice(1)
    try {
      return decodeURIComponent(raw)
    } catch (error) {
      if (error instanceof URIError) return raw
      throw error
    }
  }

  function returnTarget() {
    const navigation = performance.getEntriesByType('navigation')[0]
    if (navigation?.type !== 'back_forward') return null
    let saved = null
    try {
      saved = JSON.parse(
        sessionStorage.getItem(`sr-vt-slab:${location.pathname}`) ?? 'null',
      )
    } catch {
      document.documentElement.dataset.storage = 'unavailable'
    }
    return saved?.source === 'stage' ? saved.key : null
  }

  function vtName(element, key) {
    document.dispatchEvent(
      new CustomEvent('vt:name', { detail: { element, key, source: 'stage' } }),
    )
  }

  function setupShowroom(showroom) {
    const section = showroom.closest('section') ?? document
    const variant = showroom.dataset.variant
    const limit = Number(showroom.dataset.limit) || 0
    const items = [...showroom.querySelectorAll('.sr-item')]
    const stageWorld = showroom.querySelector('[data-stage-world]')
    const stage = showroom.querySelector('[data-stage]')
    const copy = showroom.querySelector('[data-info-copy]')
    const links = showroom.querySelector('[data-info-links]')
    const prev = showroom.querySelector('[data-step="-1"]')
    const next = showroom.querySelector('[data-step="1"]')
    const chipsBox = section.querySelector('[data-chips]')
    const chips = [...section.querySelectorAll('[data-filter]')]
    const status = section.querySelector('[data-filter-status]')
    const pool = new Map()
    let visible = items.filter((item) => !item.hidden)
    let selected = 0
    let filter = 'all'
    let rowTimer = 0
    const slotOrder = [0, -1, 1, -2, 2]

    const wraps = () => visible.length >= 2
    const indexAt = (index) => {
      const count = visible.length
      if (!count) return -1
      if (wraps()) return ((index % count) + count) % count
      return Math.max(0, Math.min(count - 1, index))
    }

    function slotMap() {
      const wanted = new Map()
      for (const offset of slotOrder) {
        const raw = selected + offset
        const index = wraps() ? indexAt(raw) : raw
        const item = visible[index]
        if (item && !wanted.has(item.dataset.key))
          wanted.set(item.dataset.key, { item, offset })
      }
      return wanted
    }

    const initial = stageWorld?.querySelector('.sr-slab')
    if (initial) {
      initial.classList.remove('is-current')
      initial.dataset.slot = '0'
      pool.set(initial.dataset.key, initial)
    }

    function slabFor(item) {
      const key = item.dataset.key
      if (pool.has(key)) return pool.get(key)
      const part = templatePart(item, 'slab')
      const figure = part?.querySelector('.sr-slab')
      if (!figure) return null
      pool.set(key, figure)
      return figure
    }

    function placeStage(immediate) {
      if (!stageWorld) return
      const wanted = slotMap()
      for (const [key, figure] of pool) {
        if (wanted.has(key)) continue
        const old = Number(figure.dataset.slot)
        if (immediate || reduced() || !figure.isConnected) {
          figure.remove()
          pool.delete(key)
          continue
        }
        figure.dataset.slot = old < 0 ? '-2' : '2'
        figure.setAttribute('aria-hidden', 'true')
        window.setTimeout(() => {
          if (
            !wanted.has(key) &&
            figure.dataset.slot !== '0' &&
            !visibleKeys().has(key)
          ) {
            figure.remove()
            pool.delete(key)
          }
        }, 700)
      }
      const front = [...wanted.values()].find(({ offset }) => offset === 0)
      const frontSlab = front ? slabFor(front.item) : null
      stageWorld.classList.toggle(
        'has-trio',
        Boolean(frontSlab?.classList.contains('slab-trio')),
      )
      stageWorld.classList.toggle(
        'has-phone',
        frontSlab?.dataset.kind === 'phone',
      )
      for (const { item, offset } of wanted.values()) {
        const figure = slabFor(item)
        if (!figure) continue
        if (!figure.isConnected) {
          figure.classList.add('is-instant')
          figure.dataset.slot = offset < 0 ? '-2' : '2'
          stageWorld.append(figure)
          void figure.offsetWidth
          figure.classList.remove('is-instant')
        }
        if (immediate || reduced()) figure.classList.add('is-instant')
        figure.dataset.slot = String(offset)
        if (offset === 0) figure.removeAttribute('aria-hidden')
        else figure.setAttribute('aria-hidden', 'true')
        if (immediate || reduced()) {
          void figure.offsetWidth
          figure.classList.remove('is-instant')
        }
      }
    }

    function visibleKeys() {
      return new Set(slotMap().keys())
    }

    function focusedControl() {
      const active = document.activeElement
      if (!links || !active || !links.contains(active)) return null
      if (active.matches('.sr-live')) return '.sr-live'
      return '.sr-open'
    }

    function updateInfo(animate) {
      const item = visible[selected]
      if (!item || !copy) return
      const copyPart = templatePart(item, 'copy')
      const linkPart = templatePart(item, 'links')
      const control = focusedControl()
      if (copyPart) copy.replaceChildren(...copyPart.childNodes)
      if (linkPart && links) links.replaceChildren(...linkPart.childNodes)
      if (control && links) {
        const target =
          links.querySelector(control) ?? links.querySelector('.sr-open')
        target?.focus({ preventScroll: true })
      }
      if (animate && !reduced()) {
        copy.classList.remove('is-swapping')
        void copy.offsetWidth
        copy.classList.add('is-swapping')
      }
    }

    function updateRows() {
      items.forEach((item) => {
        const row = item.querySelector('[data-row]')
        if (item === visible[selected]) row.setAttribute('aria-current', 'true')
        else row.removeAttribute('aria-current')
      })
      const single = visible.length < 2
      for (const button of [prev, next]) {
        if (!button) continue
        if (single && document.activeElement === button)
          visible[0]
            ?.querySelector('[data-row]')
            ?.focus({ preventScroll: true })
        button.disabled = single
      }
    }

    function select(index, options = {}) {
      const target = indexAt(index)
      if (target < 0) return
      const changed = target !== selected
      selected = target
      updateRows()
      placeStage(Boolean(options.immediate))
      if (changed || options.force) updateInfo(!options.immediate)
      if (options.focusRow)
        visible[selected]?.querySelector('[data-row]')?.focus()
      if (options.reveal && stage && !wideQuery.matches) {
        const navHeight =
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              '--nav-h',
            ),
          ) || 64
        const top =
          stage.getBoundingClientRect().top + window.scrollY - navHeight - 16
        if (Math.abs(stage.getBoundingClientRect().top - navHeight - 16) > 24)
          window.scrollTo({ top, behavior: reduced() ? 'auto' : 'smooth' })
      }
    }

    function applyFilter(name) {
      filter = name
      const matches = items.filter(
        (item) =>
          name === 'all' || item.dataset.category.split(' ').includes(name),
      )
      const shown = limit ? matches.slice(0, limit) : matches
      const previous = new Set(visible)
      const leaving = items.filter(
        (item) => previous.has(item) && !shown.includes(item),
      )
      const entering = shown.filter((item) => !previous.has(item))
      window.clearTimeout(rowTimer)
      items.forEach((item) => item.classList.remove('is-leaving'))
      const swapRows = () => {
        items.forEach((item) => {
          item.classList.remove('is-leaving')
          item.hidden = !shown.includes(item)
          item.classList.toggle(
            'is-entering',
            entering.includes(item) && !reduced(),
          )
        })
      }
      if (leaving.length && !reduced()) {
        items.forEach((item) => item.classList.remove('is-entering'))
        leaving.forEach((item) => item.classList.add('is-leaving'))
        rowTimer = window.setTimeout(swapRows, 160)
      } else swapRows()
      visible = shown
      chips.forEach((chip) =>
        chip.setAttribute('aria-pressed', String(chip.dataset.filter === name)),
      )
      if (status)
        status.textContent = status.dataset.template.replace(
          '{count}',
          String(shown.length),
        )
      selected = -1
      select(0, { force: true })
    }

    chipsBox?.removeAttribute('hidden')
    prev?.removeAttribute('hidden')
    next?.removeAttribute('hidden')
    chips.forEach((chip) =>
      chip.addEventListener('click', () => {
        if (chip.dataset.filter !== filter) applyFilter(chip.dataset.filter)
      }),
    )
    prev?.addEventListener('click', () => select(selected - 1))
    next?.addEventListener('click', () => select(selected + 1))

    showroom.addEventListener('click', (event) => {
      const row = event.target.closest('[data-row]')
      if (row) {
        const item = row.closest('.sr-item')
        const index = visible.indexOf(item)
        if (index < 0) return
        if (variant === 'home') {
          event.preventDefault()
          select(index, { reveal: true })
          return
        }
        if (
          !item
            .querySelector('template')
            ?.content.querySelector('[data-open-case]')
        ) {
          event.preventDefault()
          select(index, { immediate: !wideQuery.matches })
          if (!wideQuery.matches || !stage) openSheet(item.dataset.key, row)
          return
        }
        const figure = pool.get(item.dataset.key)
        if (wideQuery.matches && figure) {
          select(index, { immediate: true })
          vtName(figure, item.dataset.key)
        }
        return
      }
      const sheetButton = event.target.closest('[data-open-sheet]')
      if (sheetButton) {
        openSheet(sheetButton.dataset.openSheet, sheetButton)
        return
      }
      const caseLink = event.target.closest('[data-open-case]')
      if (caseLink) {
        const figure = pool.get(caseLink.dataset.openCase)
        if (figure?.dataset.slot === '0')
          vtName(figure, caseLink.dataset.openCase)
        return
      }
      const figure = event.target.closest('.sr-slab')
      if (figure && !event.target.closest('a')) {
        const slot = Number(figure.dataset.slot)
        if (slot === -1 || slot === 1) select(selected + slot)
      }
    })

    if (variant === 'work') {
      const preview = (event) => {
        if (!wideQuery.matches) return
        if (event.type === 'pointerover' && !fineQuery.matches) return
        const row = event.target.closest('[data-row]')
        if (!row) return
        const index = visible.indexOf(row.closest('.sr-item'))
        if (index >= 0 && index !== selected) select(index)
      }
      showroom.addEventListener('pointerover', preview)
      showroom.addEventListener('focusin', preview)
    }

    showroom.addEventListener('keydown', (event) => {
      if (
        event.target.closest('[data-filter]') ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return
      if (event.target.closest('input, textarea, select')) return
      const onRow = Boolean(event.target.closest('[data-row]'))
      const keys = {
        ArrowLeft: selected - 1,
        ArrowRight: selected + 1,
        Home: 0,
        End: visible.length - 1,
      }
      if (onRow) {
        keys.ArrowUp = selected - 1
        keys.ArrowDown = selected + 1
      }
      if (!(event.key in keys)) return
      event.preventDefault()
      select(keys[event.key], { focusRow: onRow })
    })

    if (variant === 'work' && location.hash) {
      const id = hashId()
      const target = items.find((item) => item.id === id)
      if (target) {
        select(visible.indexOf(target), { immediate: true, force: true })
        if (!wideQuery.matches || !stage)
          requestAnimationFrame(() =>
            openSheet(target.dataset.key, target.querySelector('[data-row]')),
          )
      }
    }

    const returning = returnTarget()
    if (returning) {
      const index = visible.findIndex((item) => item.dataset.key === returning)
      if (index >= 0) select(index, { immediate: true, force: true })
    }

    updateRows()
    placeStage(true)
  }

  document.querySelectorAll('[data-showroom]').forEach(setupShowroom)

  const services = document.querySelector('[data-services]')
  if (services) {
    const rows = [...services.querySelectorAll('[data-svc]')]
    const stands = [...services.querySelectorAll('[data-stand]')]
    let active = 0
    const activate = (index) => {
      if (index === active || !stands[index]) return
      const leaving = stands[active]
      leaving?.classList.remove('is-active')
      if (leaving && !reduced()) {
        leaving.classList.add('is-leaving')
        window.setTimeout(() => leaving.classList.remove('is-leaving'), 200)
      }
      active = index
      stands[index].classList.remove('is-leaving')
      stands[index].classList.add('is-active')
      rows.forEach((row, i) => {
        if (i === index) row.setAttribute('aria-current', 'true')
        else row.removeAttribute('aria-current')
      })
    }
    const pick = (event) => {
      const row = event.target.closest('[data-svc]')
      if (row) activate(Number(row.dataset.svc))
    }
    services.addEventListener('pointerover', (event) => {
      if (fineQuery.matches) pick(event)
    })
    services.addEventListener('focusin', pick)
  }

  document.querySelectorAll('[data-tilt]').forEach((element) => {
    const move = (event) => {
      if (!fineQuery.matches || reduced() || !wideQuery.matches) return
      const rect = element.getBoundingClientRect()
      const nx = Math.max(
        -1,
        Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1),
      )
      const ny = Math.max(
        -1,
        Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1),
      )
      element.style.setProperty('--tilt-y', `${(nx * 4).toFixed(2)}deg`)
      element.style.setProperty('--tilt-x', `${(-ny * 4).toFixed(2)}deg`)
    }
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerleave', () => {
      element.style.removeProperty('--tilt-y')
      element.style.removeProperty('--tilt-x')
    })
  })
})()
