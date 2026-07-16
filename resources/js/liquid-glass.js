/**
 * Liquid Glass Engine — Vanilla JS port
 *
 * Ported from LiquidGlass.tsx / GlassDropdown.tsx (estella-editor-server)
 * Physical refraction via SVG feDisplacementMap, computed from Snell's law
 * on a squircle dome surface.
 *
 * Public API:
 *   initLiquidGlass()          — call once on DOMContentLoaded
 *   LiquidSelect.create(el)    — wrap a <select> in a glass dropdown
 */

// Popover API support check — used to render the dropdown in the browser's
// top layer (composited independently of the rest of the document), which
// sidesteps a compositor/occlusion bug where the dropdown, as a plain
// position:fixed element, would intermittently fail to paint over content
// further down the page (e.g. the execute button) despite correct z-index
// and fully opaque backgrounds. Falls back to plain display toggling on
// engines that don't support it.
const SUPPORTS_POPOVER = typeof document.createElement('div').showPopover === 'function'

// ─── Displacement Map Generator ───────────────────────────────────────────────

function roundedRectSDF(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - halfW + r
  const qy = Math.abs(py) - halfH + r
  const outsideX = Math.max(qx, 0)
  const outsideY = Math.max(qy, 0)
  const outsideDist = Math.sqrt(outsideX * outsideX + outsideY * outsideY) - r
  const insideDist = Math.min(Math.max(qx, qy), 0) - r
  const dist = qx > 0 || qy > 0 ? outsideDist : insideDist

  let nx, ny
  if (qx > 0 && qy > 0) {
    const len = Math.sqrt(qx * qx + qy * qy) || 1
    nx = (qx / len) * Math.sign(px)
    ny = (qy / len) * Math.sign(py)
  } else if (qx > qy) {
    nx = Math.sign(px); ny = 0
  } else {
    nx = 0; ny = Math.sign(py)
  }
  return { dist, nx, ny }
}

function generateDisplacementMap(width, height, cornerRadius, gain = 40) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  const halfW = width / 2
  const halfH = height / 2
  const r = Math.min(cornerRadius, halfW, halfH)
  const rimWidth = Math.min(r * 1.2, Math.min(halfW, halfH) * 0.35)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x - halfW
      const py = y - halfH
      const { dist, nx, ny } = roundedRectSDF(px, py, halfW, halfH, r)

      let depth = 0
      if (dist < 0) depth = Math.min(-dist / rimWidth, 1)

      const d = depth
      let slope = 0
      if (d > 0 && d < 1) {
        const oneMinusD = 1 - d
        const num = oneMinusD * oneMinusD * oneMinusD
        const den4 = 1 - oneMinusD * oneMinusD * oneMinusD * oneMinusD
        const den = Math.pow(Math.max(den4, 1e-6), 0.75)
        slope = num / den
      }

      const thetaI = Math.atan(slope)
      const sinThetaT = Math.sin(thetaI) / 1.5
      const thetaT = Math.asin(Math.min(sinThetaT, 1))
      const bend = Math.sin(thetaI - thetaT)

      const dr = 128 + nx * bend * gain
      const dg = 128 + ny * bend * gain
      const specular = (1 - depth) * 255 * 0.3

      const idx = (y * width + x) * 4
      data[idx + 0] = Math.max(0, Math.min(255, Math.round(dr)))
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(dg)))
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(specular)))
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const dataUrl = canvas.toDataURL('image/png')
  const binary = atob(dataUrl.split(',')[1])
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i)
  return URL.createObjectURL(new Blob([array], { type: 'image/png' }))
}

// Cache by "WxH@R:gain"
const _mapCache = new Map()
function getOrCreateMap(w, h, r, gain = 40) {
  const key = `${w}x${h}@${r}:${gain}`
  if (_mapCache.has(key)) return _mapCache.get(key)
  const url = generateDisplacementMap(w, h, r, gain)
  _mapCache.set(key, url)
  return url
}

let _filterId = 0
function nextFilterId() { return `glf-${++_filterId}-${Date.now()}` }

// ─── GlassLens DOM builder ─────────────────────────────────────────────────────

/**
 * Wrap an element with the liquid glass lens layers.
 * Returns { lensEl, contentEl, destroy }
 */
function createGlassLens({ radius = 12, gain = 80, className = '', glass = true } = {}) {
  // SVG filter (injected once per lens) — only needed when `glass` refraction
  // is enabled.
  const svgNS = 'http://www.w3.org/2000/svg'
  const svgEl = glass ? document.createElementNS(svgNS, 'svg') : null
  let defs = null
  if (glass) {
    svgEl.classList.add('glass-svg-filters')
    svgEl.setAttribute('aria-hidden', 'true')
    defs = document.createElementNS(svgNS, 'defs')
    svgEl.appendChild(defs)
    document.body.appendChild(svgEl)
  }

  const lensEl = document.createElement('div')
  lensEl.className = `glass-lens ${className}${glass ? '' : ' glass-lens--flat'}`
  lensEl.style.setProperty('--glass-radius', `${radius}px`)

  const refractedEl = document.createElement('div')
  refractedEl.className = 'glass-lens__refracted'

  const frostEl = document.createElement('div')
  frostEl.className = 'glass-lens__frost'

  const rimEl = document.createElement('div')
  rimEl.className = 'glass-lens__rim'

  const tintEl = document.createElement('div')
  tintEl.className = 'glass-lens__tint'

  const contentEl = document.createElement('div')
  contentEl.className = 'glass-lens__content'

  lensEl.append(refractedEl, frostEl, rimEl, tintEl, contentEl)

  // ResizeObserver to regenerate the SVG refraction map when size changes.
  // Skipped entirely when `glass` is false: for panels that are portaled to
  // <body> as position:fixed and repositioned/resized dynamically via JS
  // (LiquidSelect's dropdown), backdrop-filter (both this SVG refraction and
  // the plain CSS blur on .glass-lens__frost) was found to be unreliable in
  // this engine — computed styles check out via DevTools, but nothing
  // actually gets painted after the panel moves. Falling back to the
  // layered solid backgrounds (frost + tint, no blur) avoids that entirely.
  let ro = null
  let currentFId = null
  if (glass) {
    ro = new ResizeObserver(() => {
      const rect = lensEl.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      if (w < 1 || h < 1) return

      const r = Math.min(radius, w / 2, h / 2)
      const mapUrl = getOrCreateMap(w, h, r, gain)
      const fId = nextFilterId()

      // Update SVG filter
      defs.innerHTML = ''
      const filter = document.createElementNS(svgNS, 'filter')
      filter.id = fId
      filter.setAttribute('x', '0')
      filter.setAttribute('y', '0')
      filter.setAttribute('width', '100%')
      filter.setAttribute('height', '100%')
      filter.setAttribute('color-interpolation-filters', 'sRGB')

      const feImg = document.createElementNS(svgNS, 'feImage')
      feImg.setAttribute('href', mapUrl)
      feImg.setAttribute('result', 'dispMap')
      feImg.setAttribute('x', '0'); feImg.setAttribute('y', '0')
      feImg.setAttribute('width', '100%'); feImg.setAttribute('height', '100%')
      feImg.setAttribute('preserveAspectRatio', 'none')

      const feDisp = document.createElementNS(svgNS, 'feDisplacementMap')
      feDisp.setAttribute('in', 'SourceGraphic')
      feDisp.setAttribute('in2', 'dispMap')
      feDisp.setAttribute('scale', '50')
      feDisp.setAttribute('xChannelSelector', 'R')
      feDisp.setAttribute('yChannelSelector', 'G')
      feDisp.setAttribute('result', 'refracted')

      const feColor = document.createElementNS(svgNS, 'feColorMatrix')
      feColor.setAttribute('in', 'dispMap')
      feColor.setAttribute('type', 'matrix')
      feColor.setAttribute('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0')
      feColor.setAttribute('result', 'specAlpha')

      const feFlood = document.createElementNS(svgNS, 'feFlood')
      feFlood.setAttribute('flood-color', 'white')
      feFlood.setAttribute('flood-opacity', '0.28')
      feFlood.setAttribute('result', 'specColor')

      const feComp1 = document.createElementNS(svgNS, 'feComposite')
      feComp1.setAttribute('in', 'specColor'); feComp1.setAttribute('in2', 'specAlpha')
      feComp1.setAttribute('operator', 'in'); feComp1.setAttribute('result', 'specular')

      const feComp2 = document.createElementNS(svgNS, 'feComposite')
      feComp2.setAttribute('in', 'specular'); feComp2.setAttribute('in2', 'refracted')
      feComp2.setAttribute('operator', 'over')

      filter.append(feImg, feDisp, feColor, feFlood, feComp1, feComp2)
      defs.appendChild(filter)

      // Apply to refracted layer
      refractedEl.style.backdropFilter = `url(#${fId})`
      refractedEl.style.webkitBackdropFilter = `url(#${fId})`
      currentFId = fId
    })
    ro.observe(lensEl)
  }

  function destroy() {
    if (ro) ro.disconnect()
    if (svgEl) svgEl.remove()
  }

  return { lensEl, contentEl, destroy }
}

// ─── LiquidSelect — wraps a native <select> ────────────────────────────────────

/**
 * Replaces a native <select> element with a custom liquid-glass dropdown.
 * The original <select> is hidden but remains in the DOM (still participates
 * in form values and all existing JS event listeners work unchanged).
 */
const LiquidSelect = {
  _instances: new WeakMap(),
  _uidCounter: 0,

  create(selectEl) {
    if (this._instances.has(selectEl)) return
    selectEl.style.display = 'none'

    // ── Trigger button ──
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'lg-trigger'
    trigger.setAttribute('aria-haspopup', 'listbox')
    trigger.setAttribute('aria-expanded', 'false')

    const triggerText = document.createElement('span')
    triggerText.className = 'lg-trigger__text'

    const triggerChevron = document.createElement('span')
    triggerChevron.className = 'lg-trigger__chevron'
    triggerChevron.innerHTML = `<svg viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`

    trigger.append(triggerText, triggerChevron)

    // ── Dropdown panel (glass lens, flat/no-blur — see createGlassLens) ──
    const { lensEl: dropPanel, contentEl: dropContent, destroy } =
      createGlassLens({ radius: 10, gain: 55, className: 'lg-dropdown', glass: false })
    dropPanel.setAttribute('role', 'listbox')
    if (SUPPORTS_POPOVER) {
      // "manual" — we drive open/close ourselves (outside-click, scroll,
      // Escape); the browser won't light-dismiss it on its own. Do NOT also
      // set style.display here: an inline `display:none` would block
      // showPopover() from ever making it visible.
      dropPanel.setAttribute('popover', 'manual')
    } else {
      dropPanel.style.display = 'none'
    }

    // Wrapper
    const wrapper = document.createElement('div')
    wrapper.className = 'lg-wrapper'
    selectEl.parentNode.insertBefore(wrapper, selectEl)
    wrapper.appendChild(selectEl)
    wrapper.appendChild(trigger)
    // Dropdown panel is portaled to <body> (position: fixed) so it can never
    // be clipped by an ancestor's `overflow: hidden` (e.g. .panel) — its
    // position is computed from the trigger's own rect in openDropdown().
    document.body.appendChild(dropPanel)

    // Unique id prefix for this instance's option elements, so the trigger
    // can point aria-activedescendant at one of them -- selectEl.id isn't
    // guaranteed unique across every GlassSelect caller in the tree, but
    // this counter always is.
    const uidPrefix = `lg-opt-${++LiquidSelect._uidCounter}`

    // Commits opt as the selected value and closes -- shared by the mouse
    // path (mousedown below) and the keyboard path (Enter/Space in
    // openDropdown's keydown handler), so both stay in sync by construction
    // instead of two copies of the same three lines drifting apart.
    const commitOption = (opt) => {
      selectEl.value = opt.value
      selectEl.dispatchEvent(new Event('change', { bubbles: true }))
      selectEl.dispatchEvent(new Event('input', { bubbles: true }))
      syncTrigger()
      closeDropdown()
    }

    // ── Build option list ──
    const rebuildOptions = () => {
      dropContent.innerHTML = ''
      const options = Array.from(selectEl.options)
      options.forEach((opt, i) => {
        const item = document.createElement('div')
        item.className = 'lg-option'
        item.id = `${uidPrefix}-${i}`
        item.setAttribute('role', 'option')
        item.setAttribute('data-value', opt.value)
        item.setAttribute('aria-selected', opt.selected ? 'true' : 'false')
        item.textContent = opt.text
        if (opt.selected) item.classList.add('is-selected')

        item.addEventListener('mousedown', (e) => {
          e.preventDefault()
          commitOption(opt)
        })
        dropContent.appendChild(item)
      })
    }

    const syncTrigger = () => {
      const sel = selectEl.options[selectEl.selectedIndex]
      triggerText.textContent = sel ? sel.text : ''
      // Sync is-selected on items
      dropContent.querySelectorAll('.lg-option').forEach(el => {
        el.classList.toggle('is-selected', el.dataset.value === selectEl.value)
        el.setAttribute('aria-selected', el.dataset.value === selectEl.value ? 'true' : 'false')
      })
    }

    // ── Keyboard roving highlight ── separate from is-selected (which
    // tracks the persisted <select> value): this is "which option would
    // Enter commit right now", following aria-activedescendant's usual
    // combobox/listbox pattern instead of moving real DOM focus off the
    // trigger button.
    let highlightedIndex = -1
    const setHighlighted = (idx) => {
      const items = dropContent.querySelectorAll('.lg-option')
      highlightedIndex = idx
      items.forEach((el, i) => el.classList.toggle('is-highlighted', i === idx))
      if (idx >= 0 && items[idx]) {
        trigger.setAttribute('aria-activedescendant', items[idx].id)
        items[idx].scrollIntoView({ block: 'nearest' })
      } else {
        trigger.removeAttribute('aria-activedescendant')
      }
    }
    const moveHighlighted = (delta) => {
      const items = dropContent.querySelectorAll('.lg-option')
      if (!items.length) return
      setHighlighted(Math.min(items.length - 1, Math.max(0, highlightedIndex + delta)))
    }

    // ── Open / close ──
    let isOpen = false
    let closeTimeout = null

    const openDropdown = () => {
      if (isOpen) return
      isOpen = true
      clearTimeout(closeTimeout)

      // Portaled to <body> as position:fixed, so position it from the
      // trigger's own viewport rect — this can never be clipped by an
      // ancestor's `overflow: hidden` (e.g. .panel) the way an
      // absolutely-positioned child of .lg-wrapper could be.
      const gap = 4
      const preferredMax = 220
      const rect = trigger.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom - gap
      const spaceAbove = rect.top - gap
      const openUpward = spaceBelow < 100 && spaceAbove > spaceBelow

      dropPanel.classList.remove('lg-dropdown--closing')

      dropPanel.style.position = 'fixed'
      dropPanel.style.left = `${rect.left}px`
      dropPanel.style.width = `${rect.width}px`

      if (openUpward) {
        dropPanel.style.top = 'auto'
        dropPanel.style.bottom = `${window.innerHeight - rect.top + gap}px`
        dropPanel.style.maxHeight = `${Math.max(80, Math.min(preferredMax, spaceAbove))}px`
      } else {
        dropPanel.style.top = `${rect.bottom + gap}px`
        dropPanel.style.bottom = 'auto'
        dropPanel.style.maxHeight = `${Math.max(80, Math.min(preferredMax, spaceBelow))}px`
      }
      // Origin-aware popover (review-animations/STANDARDS.md "Physicality"):
      // scale from the trigger edge it opens off of, not the panel's own
      // center — the panel is left-aligned + width-matched to the trigger,
      // so top/bottom-center is an accurate anchor.
      dropPanel.style.transformOrigin = openUpward ? 'bottom center' : 'top center'

      if (SUPPORTS_POPOVER) {
        // Top-layer rendering — composited independently of the rest of the
        // document, so it can't suffer the occlusion/paint bug plain
        // position:fixed had here (confirmed via DevTools: computed styles
        // were correct but pixels weren't painted after this panel moved).
        if (dropPanel.matches(':popover-open')) dropPanel.hidePopover()
        dropPanel.showPopover()
      } else {
        // Fallback: fully hide, apply geometry, force a synchronous reflow,
        // then show again — discards any stale compositor layer from the
        // panel's previous position/size.
        dropPanel.style.display = 'none'
        void dropPanel.offsetHeight
        dropPanel.style.display = ''
      }

      dropPanel.classList.add('lg-dropdown--open')
      trigger.setAttribute('aria-expanded', 'true')
      // Start keyboard roving-highlight on the current value (falls back to
      // the first option) so ArrowDown/ArrowUp/Enter work immediately after
      // opening without a mouse ever touching the list.
      const items = dropContent.querySelectorAll('.lg-option')
      let startIndex = Array.prototype.findIndex.call(items, el => el.classList.contains('is-selected'))
      if (startIndex < 0) startIndex = 0
      setHighlighted(items.length ? startIndex : -1)
    }

    const closeDropdown = () => {
      if (!isOpen) return
      isOpen = false
      dropPanel.classList.remove('lg-dropdown--open')
      dropPanel.classList.add('lg-dropdown--closing')
      trigger.setAttribute('aria-expanded', 'false')
      trigger.removeAttribute('aria-activedescendant')
      closeTimeout = setTimeout(() => {
        if (SUPPORTS_POPOVER) {
          if (dropPanel.matches(':popover-open')) dropPanel.hidePopover()
        } else {
          dropPanel.style.display = 'none'
        }
        dropPanel.classList.remove('lg-dropdown--closing')
      }, 120)
    }

    const toggleDropdown = () => isOpen ? closeDropdown() : openDropdown()

    trigger.addEventListener('click', (e) => {
      e.stopPropagation()
      toggleDropdown()
    })

    // Close on outside click — dropPanel is portaled to <body>, so it's no
    // longer inside `wrapper` and must be checked separately.
    const onDocClick = (e) => {
      if (!wrapper.contains(e.target) && !dropPanel.contains(e.target)) closeDropdown()
    }
    document.addEventListener('click', onDocClick)

    // Close on scroll instead of tracking the trigger's moving position —
    // the dropdown (now position:fixed) would otherwise be left floating in
    // a stale spot. #main-content is always the outermost scroll container,
    // but #settings-section/#tool-intro can also scroll independently on
    // short windows (see styles.css), so walk up and listen on every
    // scrollable ancestor, not just the outermost one.
    // (Deliberately NOT closing on window `resize`: that also fires when
    // DevTools opens/docks and shrinks the viewport, which was closing the
    // dropdown out from under any attempt to inspect it.)
    const onMainScroll = () => closeDropdown()
    const scrollParents = []
    for (let node = wrapper.parentElement; node; node = node.parentElement) {
      if (getComputedStyle(node).overflowY === 'auto' || getComputedStyle(node).overflowY === 'scroll') {
        scrollParents.push(node)
      }
    }
    const mainContentEl = document.getElementById('main-content')
    if (mainContentEl && !scrollParents.includes(mainContentEl)) scrollParents.push(mainContentEl)
    scrollParents.forEach((el) => el.addEventListener('scroll', onMainScroll, { passive: true }))

    // Keyboard nav — full roving-highlight combobox pattern so the list is
    // actually usable without a mouse (previously Enter/Space only toggled
    // open/closed and there was no way to move through or commit an option
    // from the keyboard at all).
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!isOpen) { openDropdown(); return }
        const opt = selectEl.options[highlightedIndex]
        if (opt) commitOption(opt)
        else closeDropdown()
      } else if (e.key === 'Escape') {
        closeDropdown()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (!isOpen) openDropdown()
        else moveHighlighted(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (!isOpen) openDropdown()
        else moveHighlighted(-1)
      } else if (e.key === 'Home' && isOpen) {
        e.preventDefault()
        setHighlighted(0)
      } else if (e.key === 'End' && isOpen) {
        e.preventDefault()
        setHighlighted(dropContent.querySelectorAll('.lg-option').length - 1)
      }
    })

    // Sync when underlying select changes externally
    const onSelectChange = () => syncTrigger()
    selectEl.addEventListener('change', onSelectChange)

    // ── Disabled state ──
    const syncDisabled = () => {
      trigger.disabled = selectEl.disabled
      wrapper.classList.toggle('lg-wrapper--disabled', selectEl.disabled)
    }
    const disabledObserver = new MutationObserver(syncDisabled)
    disabledObserver.observe(selectEl, { attributes: true, attributeFilter: ['disabled'] })

    rebuildOptions()
    syncTrigger()
    syncDisabled()

    this._instances.set(selectEl, {
      destroy, onDocClick, onSelectChange, disabledObserver, wrapper,
      dropPanel, scrollParents, onMainScroll
    })
  },

  /** Sync trigger text without re-creating (call after programmatic value change) */
  sync(selectEl) {
    const inst = this._instances.get(selectEl)
    if (!inst) return
    const sel = selectEl.options[selectEl.selectedIndex]
    const trigger = inst.wrapper.querySelector('.lg-trigger__text')
    if (trigger && sel) trigger.textContent = sel.text
    inst.dropPanel.querySelectorAll('.lg-option').forEach(el => {
      el.classList.toggle('is-selected', el.dataset.value === selectEl.value)
    })
  },

  destroy(selectEl) {
    const inst = this._instances.get(selectEl)
    if (!inst) return
    inst.destroy()
    document.removeEventListener('click', inst.onDocClick)
    selectEl.removeEventListener('change', inst.onSelectChange)
    inst.scrollParents.forEach((el) => el.removeEventListener('scroll', inst.onMainScroll))
    inst.disabledObserver.disconnect()
    inst.dropPanel.remove() // portaled to <body>, not a child of wrapper
    inst.wrapper.replaceWith(selectEl)
    selectEl.style.display = ''
    this._instances.delete(selectEl)
  }
}

// ─── Refraction-only attachment ───────────────────────────────────────────────

/**
 * Attaches a full liquid-glass backdrop chain -- blur + saturation +
 * Snell's-law edge refraction (the same displacement map createGlassLens
 * uses) + specular rim -- as ONE combined SVG filter applied directly to
 * the element via `backdrop-filter: url(#filter)`. Same reference
 * technique as the iOS-26-style liquid-glass demos (physics displacement
 * map + backdrop-filter).
 *
 * Everything lives in a single filter on a single element on purpose:
 * splitting blur and refraction across two stacked child layers (the
 * .glass-lens structure) does not paint on a GPU-promoted host in this
 * engine -- verified directly on the hamburger dropdown, whose open/close
 * keyframe animation promotes it: children's backdrop-filters computed
 * fine but painted nothing, while a backdrop-filter on the animated
 * element itself paints reliably. Related to the compositing bug
 * documented at .glass-lens--flat in styles.css.
 *
 * The element MUST NOT sit under an ancestor that itself has
 * backdrop-filter (that ancestor becomes the backdrop root and this filter
 * would sample nothing -- the exact bug that silently disabled the
 * hamburger dropdown's plain blur before). `backdrop-filter: url()` is
 * Chromium-only; on engines that don't support it this leaves the caller's
 * own CSS backdrop-filter fallback (plain blur) untouched and returns a
 * no-op destroy -- same degradation the reference implementations accept.
 *
 * Returns a destroy() function.
 */
function attachRefraction(layerEl, { radius = 10, gain = 60, blur = 12, saturate = 1.7 } = {}) {
  if (!(typeof CSS !== 'undefined' && CSS.supports && CSS.supports('backdrop-filter', 'url(#x)'))) {
    return function destroy() {}
  }

  const svgNS = 'http://www.w3.org/2000/svg'
  const svgEl = document.createElementNS(svgNS, 'svg')
  svgEl.classList.add('glass-svg-filters')
  svgEl.setAttribute('aria-hidden', 'true')
  const defs = document.createElementNS(svgNS, 'defs')
  svgEl.appendChild(defs)
  document.body.appendChild(svgEl)

  const ro = new ResizeObserver(() => {
    const rect = layerEl.getBoundingClientRect()
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)
    if (w < 1 || h < 1) return

    const r = Math.min(radius, w / 2, h / 2)
    const mapUrl = getOrCreateMap(w, h, r, gain)
    const fId = nextFilterId()

    defs.innerHTML = ''
    const filter = document.createElementNS(svgNS, 'filter')
    filter.id = fId
    filter.setAttribute('x', '0')
    filter.setAttribute('y', '0')
    filter.setAttribute('width', '100%')
    filter.setAttribute('height', '100%')
    filter.setAttribute('color-interpolation-filters', 'sRGB')

    // Frost first: blur + saturate the sampled backdrop, THEN refract the
    // frosted result -- matches how physical frosted glass reads (the
    // distortion bends already-diffused light at the rim).
    const feBlur = document.createElementNS(svgNS, 'feGaussianBlur')
    feBlur.setAttribute('in', 'SourceGraphic')
    feBlur.setAttribute('stdDeviation', String(blur))
    feBlur.setAttribute('result', 'blurred')

    const feSat = document.createElementNS(svgNS, 'feColorMatrix')
    feSat.setAttribute('in', 'blurred')
    feSat.setAttribute('type', 'saturate')
    feSat.setAttribute('values', String(saturate))
    feSat.setAttribute('result', 'frosted')

    const feImg = document.createElementNS(svgNS, 'feImage')
    feImg.setAttribute('href', mapUrl)
    feImg.setAttribute('result', 'dispMap')
    feImg.setAttribute('x', '0'); feImg.setAttribute('y', '0')
    feImg.setAttribute('width', '100%'); feImg.setAttribute('height', '100%')
    feImg.setAttribute('preserveAspectRatio', 'none')

    const feDisp = document.createElementNS(svgNS, 'feDisplacementMap')
    feDisp.setAttribute('in', 'frosted')
    feDisp.setAttribute('in2', 'dispMap')
    feDisp.setAttribute('scale', '50')
    feDisp.setAttribute('xChannelSelector', 'R')
    feDisp.setAttribute('yChannelSelector', 'G')
    feDisp.setAttribute('result', 'refracted')

    const feColor = document.createElementNS(svgNS, 'feColorMatrix')
    feColor.setAttribute('in', 'dispMap')
    feColor.setAttribute('type', 'matrix')
    feColor.setAttribute('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0')
    feColor.setAttribute('result', 'specAlpha')

    const feFlood = document.createElementNS(svgNS, 'feFlood')
    feFlood.setAttribute('flood-color', 'white')
    feFlood.setAttribute('flood-opacity', '0.28')
    feFlood.setAttribute('result', 'specColor')

    const feComp1 = document.createElementNS(svgNS, 'feComposite')
    feComp1.setAttribute('in', 'specColor'); feComp1.setAttribute('in2', 'specAlpha')
    feComp1.setAttribute('operator', 'in'); feComp1.setAttribute('result', 'specular')

    const feComp2 = document.createElementNS(svgNS, 'feComposite')
    feComp2.setAttribute('in', 'specular'); feComp2.setAttribute('in2', 'refracted')
    feComp2.setAttribute('operator', 'over')

    filter.append(feBlur, feSat, feImg, feDisp, feColor, feFlood, feComp1, feComp2)
    defs.appendChild(filter)

    layerEl.style.backdropFilter = `url(#${fId})`
    layerEl.style.webkitBackdropFilter = `url(#${fId})`
  })
  ro.observe(layerEl)

  return function destroy() {
    ro.disconnect()
    svgEl.remove()
    layerEl.style.backdropFilter = ''
    layerEl.style.webkitBackdropFilter = ''
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────────

function initLiquidGlass() {
  document.querySelectorAll('select.input').forEach(el => LiquidSelect.create(el))
}

window.LiquidSelect = LiquidSelect
window.initLiquidGlass = initLiquidGlass
window.LiquidGlass = { attachRefraction }
