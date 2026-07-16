<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core'
  import { onMount } from 'svelte'
  import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
  import { playerLive, reducedMotion } from '../worldState'
  import { walkHeight } from '../data/sunmereVale'

  let cameraRef = $state<PerspectiveCamera>()
  /** Pulled back so the vale reads as a JRPG diorama, not a close third-person shot. */
  let distance = 30
  /** Soft follow anchor — camera + lookAt are rigid offsets from this, so framing never shears. */
  const follow = new Vector3(playerLive.x, walkHeight(playerLive.x, playerLive.z), playerLive.z)
  const desired = new Vector3()
  const target = new Vector3()
  const { canvas } = useThrelte()

  // Soft isometric: SE of the party, steeper pitch (~43°) for classic JRPG map framing.
  const OFFSET_X = 0.66
  const OFFSET_Y = 0.98
  const OFFSET_Z = 0.82
  const LOOK_HEIGHT = 1.15
  // Pull look-at slightly "into" the shot (opposite the camera offset) for composition,
  // still rigid in follow-space so left/right strafe does not yaw or roll the horizon.
  const lookSpan = Math.hypot(OFFSET_X, OFFSET_Z)
  const LOOK_X = (-OFFSET_X / lookSpan) * 2.8
  const LOOK_Z = (-OFFSET_Z / lookSpan) * 2.8

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    distance = MathUtils.clamp(distance + event.deltaY * 0.012, 22, 42)
  }

  onMount(() => {
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  })

  useTask((delta) => {
    if (!cameraRef) return

    const { x, z } = playerLive
    const groundY = walkHeight(x, z)
    const ease = $reducedMotion ? 1 : 1 - Math.pow(0.012, delta)
    follow.x += (x - follow.x) * ease
    follow.y += (groundY - follow.y) * ease
    follow.z += (z - follow.z) * ease

    desired.set(
      follow.x + distance * OFFSET_X,
      follow.y + distance * OFFSET_Y,
      follow.z + distance * OFFSET_Z,
    )
    target.set(follow.x + LOOK_X, follow.y + LOOK_HEIGHT, follow.z + LOOK_Z)

    cameraRef.position.copy(desired)
    cameraRef.up.set(0, 1, 0)
    cameraRef.lookAt(target)
  })
</script>

<T.PerspectiveCamera
  bind:ref={cameraRef}
  makeDefault
  position={[21, 30, 45]}
  fov={36}
  near={0.15}
  far={220}
/>
