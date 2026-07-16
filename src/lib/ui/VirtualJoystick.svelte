<script lang="ts">
  import { onMount } from 'svelte'
  import { clearTouchMove, introVisible, touchMove } from '../world/worldState'

  const BASE_SIZE = 104
  const KNOB_TRAVEL = 30
  const DEADZONE = 16

  /** Screen angle → [inputRight, inputForward], 8-way binary. */
  const SECTOR_AXES: Record<number, readonly [number, number]> = {
    0: [1, 0],
    1: [1, -1],
    2: [0, -1],
    3: [-1, -1],
    4: [-1, 0],
    [-4]: [-1, 0],
    [-3]: [-1, 1],
    [-2]: [0, 1],
    [-1]: [1, 1],
  }

  let active = $state(false)
  let originX = $state(0)
  let originY = $state(0)
  let knobX = $state(0)
  let knobY = $state(0)
  let pointerId: number | null = null

  function isInteractiveTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false
    return Boolean(target.closest('button, a, input, textarea, select, .menu, .interaction'))
  }

  function applyAxes(dx: number, dy: number) {
    const distance = Math.hypot(dx, dy)
    if (distance < DEADZONE) {
      knobX = 0
      knobY = 0
      clearTouchMove()
      return
    }

    const angle = Math.atan2(dy, dx)
    const sector = Math.round(angle / (Math.PI / 4))
    const [right, forward] = SECTOR_AXES[sector] ?? [0, 0]
    touchMove.right = right
    touchMove.forward = forward

    const length = Math.hypot(right, -forward) || 1
    knobX = (right / length) * KNOB_TRAVEL
    knobY = (-forward / length) * KNOB_TRAVEL
  }

  function release() {
    if (!active && pointerId === null) return
    active = false
    pointerId = null
    knobX = 0
    knobY = 0
    clearTouchMove()
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'touch') return
    if (pointerId !== null) return
    if (isInteractiveTarget(event.target)) return

    pointerId = event.pointerId
    active = true
    originX = event.clientX
    originY = event.clientY
    knobX = 0
    knobY = 0
    clearTouchMove()
    introVisible.set(false)
    event.preventDefault()
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    applyAxes(event.clientX - originX, event.clientY - originY)
    event.preventDefault()
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    release()
  }

  onMount(() => {
    const opts: AddEventListenerOptions = { capture: true, passive: false }
    const upOpts: AddEventListenerOptions = { capture: true }
    window.addEventListener('pointerdown', onPointerDown, opts)
    window.addEventListener('pointermove', onPointerMove, opts)
    window.addEventListener('pointerup', onPointerUp, upOpts)
    window.addEventListener('pointercancel', onPointerUp, upOpts)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, opts)
      window.removeEventListener('pointermove', onPointerMove, opts)
      window.removeEventListener('pointerup', onPointerUp, upOpts)
      window.removeEventListener('pointercancel', onPointerUp, upOpts)
      window.removeEventListener('blur', release)
      release()
    }
  })
</script>

<div class="touch-stick-layer" data-testid="virtual-joystick-layer" data-active={active ? 'true' : 'false'}>
  {#if active}
    <div
      class="virtual-joystick"
      style={`left:${originX}px;top:${originY}px;--base:${BASE_SIZE}px`}
      aria-hidden="true"
    >
      <div class="stick-base"></div>
      <div class="stick-knob" style={`transform:translate(${knobX}px,${knobY}px)`}></div>
    </div>
  {/if}
</div>
