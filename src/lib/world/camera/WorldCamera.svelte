<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
  import {
    cameraMode,
    combatLive,
    dialogueAnchor,
    markDialogueReady,
    playerLive,
    reducedMotion,
    tickCombatLive,
  } from '../worldState'
  import { walkHeight } from '../data/sunmereVale'
  import { converseTuning } from './converseTuning'
  import { combatImpact } from '../combat'

  let cameraRef = $state<PerspectiveCamera>()
  /** Pulled back so the vale reads as a JRPG diorama, not a close third-person shot. */
  let distance = 30
  /** Soft follow anchor — camera + lookAt are rigid offsets from this, so framing never shears. */
  const follow = new Vector3(playerLive.x, walkHeight(playerLive.x, playerLive.z), playerLive.z)
  const explorePos = new Vector3()
  const exploreLook = new Vector3()
  const conversePos = new Vector3()
  const converseLook = new Vector3()
  const blendedPos = new Vector3()
  const blendedLook = new Vector3()
  const currentPos = new Vector3()
  const currentLook = new Vector3()
  const cluster = new Vector3()
  const headWorld = new Vector3()
  const headNdc = new Vector3()
  const { canvas } = useThrelte()

  // Soft isometric: SE of the party, steeper pitch (~43°) for classic JRPG map framing.
  const OFFSET_X = 0.66
  const OFFSET_Y = 0.98
  const OFFSET_Z = 0.82
  const LOOK_HEIGHT = 1.15
  const lookSpan = Math.hypot(OFFSET_X, OFFSET_Z)
  const LOOK_X = (-OFFSET_X / lookSpan) * 2.8
  const LOOK_Z = (-OFFSET_Z / lookSpan) * 2.8
  const EXPLORE_FOV = 36
  /** Combat pulls in — tighter FOV + shorter rig for anticipation. */
  const COMBAT_FOV = 30.5
  const COMBAT_DISTANCE_SCALE = 0.78
  /**
   * Aim slightly toward feet while zoomed in so the party sits higher in frame
   * (positive look-Y pushes sprites down the screen under this isometric perch).
   */
  const COMBAT_LOOK_LIFT = -0.55

  let converseBlend = 0
  let framed = false
  let posInitialized = false
  let impactSerial = combatImpact.serial
  let shakeElapsed = 0
  let shakeDuration = 0
  let shakeStrength = 0

  function onWheel(event: WheelEvent) {
    if (get(cameraMode).kind === 'converse') return
    event.preventDefault()
    distance = MathUtils.clamp(distance + event.deltaY * 0.012, 22, 42)
  }

  onMount(() => {
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  })

  useTask((delta) => {
    if (!cameraRef) return

    const mode = get(cameraMode)
    const tuning = get(converseTuning)
    tickCombatLive(delta, $reducedMotion)
    // Converse framing owns the shot — combat dolly only affects explore.
    const combatMix = mode.kind === 'converse' ? 0 : combatLive.intensity
    const { x, z } = playerLive
    const groundY = walkHeight(x, z)
    const followSnap = combatMix > 0.02 ? 0.022 : 0.012
    const exploreEase = $reducedMotion ? 1 : 1 - Math.pow(followSnap, delta)
    follow.x += (x - follow.x) * exploreEase
    follow.y += (groundY - follow.y) * exploreEase
    follow.z += (z - follow.z) * exploreEase

    const combatDist = Math.max(18, distance * COMBAT_DISTANCE_SCALE)
    const rigDistance = MathUtils.lerp(distance, combatDist, combatMix)
    const lookLift = COMBAT_LOOK_LIFT * combatMix
    explorePos.set(
      follow.x + rigDistance * OFFSET_X,
      follow.y + rigDistance * OFFSET_Y,
      follow.z + rigDistance * OFFSET_Z,
    )
    exploreLook.set(follow.x + LOOK_X, follow.y + LOOK_HEIGHT + lookLift, follow.z + LOOK_Z)

    const wantConverse = mode.kind === 'converse' ? tuning.converseStrength : 0
    const blendEase = $reducedMotion ? 1 : 1 - Math.pow(0.038, delta)
    converseBlend += (wantConverse - converseBlend) * blendEase

    if (mode.kind === 'converse') {
      const [fx, fz] = mode.focus
      const speakerGround = walkHeight(fx, fz)
      const partyW = MathUtils.clamp(tuning.partyWeight, 0, 1)
      const midX = x * partyW + fx * (1 - partyW)
      const midZ = z * partyW + fz * (1 - partyW)
      // speakerPull: slide the look target along party → speaker.
      const toSpeakerX = fx - x
      const toSpeakerZ = fz - z
      const pull = tuning.speakerPull
      let lookX = midX + toSpeakerX * pull
      let lookZ = midZ + toSpeakerZ * pull
      cluster.set(lookX, speakerGround + tuning.converseLookY, lookZ)

      let dx = x - fx
      let dz = z - fz
      const len = Math.hypot(dx, dz)
      if (len < 0.05) {
        dx = OFFSET_X
        dz = OFFSET_Z
      } else {
        dx /= len
        dz /= len
      }

      const yaw = (tuning.yawOffset * Math.PI) / 180
      const cosY = Math.cos(yaw)
      const sinY = Math.sin(yaw)
      const dirX = dx * cosY - dz * sinY
      const dirZ = dx * sinY + dz * cosY

      const rightX = -dirZ
      const rightZ = dirX
      const rightLen = Math.hypot(rightX, rightZ) || 1
      const rx = rightX / rightLen
      const rz = rightZ / rightLen

      lookX += rx * tuning.lateralBias
      lookZ += rz * tuning.lateralBias

      const dist = tuning.converseDist * MathUtils.clamp(tuning.dolly, 0.35, 2.5)
      const perchX = lookX + dirX * dist * 0.45 + OFFSET_X * 6.5
      const perchZ = lookZ + dirZ * dist * 0.45 + OFFSET_Z * 6.5
      const toCluster = Math.hypot(perchX - lookX, perchZ - lookZ)
      const aspect =
        canvas.clientWidth > 0 && canvas.clientHeight > 0
          ? canvas.clientWidth / canvas.clientHeight
          : cameraRef.aspect || 16 / 9
      const vFov = (tuning.fov * Math.PI) / 180
      const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * aspect)
      const lookShiftX = toCluster * -tuning.clusterNdcX * Math.tan(hFov * 0.5)
      const lookShiftY = toCluster * tuning.clusterNdcY * Math.tan(vFov * 0.5)

      conversePos.set(
        perchX + rx * lookShiftX * tuning.perchSideNudge,
        speakerGround + tuning.converseHeight,
        perchZ + rz * lookShiftX * tuning.perchSideNudge,
      )
      converseLook.set(
        lookX + rx * lookShiftX,
        speakerGround + tuning.converseLookY + lookShiftY,
        lookZ + rz * lookShiftX,
      )

      if (tuning.pitchOffset !== 0) {
        const pitch = (tuning.pitchOffset * Math.PI) / 180
        const flatDist = Math.hypot(conversePos.x - converseLook.x, conversePos.z - converseLook.z)
        conversePos.y = converseLook.y + Math.sin(pitch) * flatDist + (conversePos.y - converseLook.y) * Math.cos(pitch)
      }
    } else {
      conversePos.copy(explorePos)
      converseLook.copy(exploreLook)
    }

    blendedPos.copy(explorePos).lerp(conversePos, converseBlend)
    blendedLook.copy(exploreLook).lerp(converseLook, converseBlend)

    if (!posInitialized) {
      currentPos.copy(blendedPos)
      currentLook.copy(blendedLook)
      posInitialized = true
    }

    const camEase = $reducedMotion
      ? 1
      : 1 - Math.pow(mode.kind === 'converse' ? 0.045 : combatMix > 0.02 ? 0.055 : 0.04, delta)
    currentPos.lerp(blendedPos, camEase)
    currentLook.lerp(blendedLook, camEase)

    cameraRef.position.copy(currentPos)
    if (combatImpact.serial !== impactSerial) {
      impactSerial = combatImpact.serial
      shakeElapsed = 0
      shakeDuration = 0.18
      shakeStrength = combatImpact.strength
    }
    if (!$reducedMotion && shakeElapsed < shakeDuration) {
      shakeElapsed += delta
      const envelope = Math.max(0, 1 - shakeElapsed / shakeDuration) ** 2
      const punch = envelope * shakeStrength
      cameraRef.position.x += Math.sin(shakeElapsed * 91) * 0.12 * punch
      cameraRef.position.y += Math.sin(shakeElapsed * 137 + 0.7) * 0.07 * punch
      cameraRef.position.z += Math.sin(shakeElapsed * 113 + 1.4) * 0.1 * punch
    }
    cameraRef.up.set(0, 1, 0)
    cameraRef.lookAt(currentLook)

    const exploreFov = MathUtils.lerp(EXPLORE_FOV, COMBAT_FOV, combatMix)
    const targetFov = mode.kind === 'converse' || converseBlend > 0.02 ? tuning.fov : exploreFov
    // Match combat release — FOV eases out slower than it punches in.
    const fovSnap = combatLive.engaged || combatMix > 0.85 ? 0.07 : combatMix > 0.02 ? 0.028 : 0.05
    cameraRef.fov += (targetFov - cameraRef.fov) * ($reducedMotion ? 1 : 1 - Math.pow(fovSnap, delta))
    cameraRef.updateProjectionMatrix()

    if (mode.kind === 'converse') {
      if (!framed && ($reducedMotion || converseBlend > tuning.converseStrength * 0.88)) {
        framed = true
        markDialogueReady()
      }

      // Project the speaker's head into HUD-normalized coords (0..1) every frame.
      const [fx, fz] = mode.focus
      headWorld.set(
        fx + tuning.bubbleSideX,
        walkHeight(fx, fz) + tuning.bubbleHeadY,
        fz + tuning.bubbleSideZ,
      )
      cameraRef.updateMatrixWorld()
      headNdc.copy(headWorld).project(cameraRef)
      const onScreen =
        headNdc.z > -1 &&
        headNdc.z < 1 &&
        Math.abs(headNdc.x) < 1.35 &&
        Math.abs(headNdc.y) < 1.35
      dialogueAnchor.x = headNdc.x * 0.5 + 0.5
      dialogueAnchor.y = -headNdc.y * 0.5 + 0.5
      dialogueAnchor.visible = onScreen
    } else {
      framed = false
      dialogueAnchor.visible = false
    }
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
