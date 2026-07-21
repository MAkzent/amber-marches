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
  import { walkHeight } from '../data/amberMarches'
  import { combatImpact } from '../combat'
  import { converseTuning } from './converseTuning'
  import { battleTuning } from './battleTuning'
  import { resolveBattleFrame, type BattleSurfaceCell } from './battleFrame'
  import {
    hexBattleDriver,
    hexesWithin,
    hexKey,
    hexToWorldXZ,
  } from '../../battle'
  import {
    COMBAT_DISTANCE_MIN,
    COMBAT_DISTANCE_SCALE,
    COMBAT_FOV,
    COMBAT_LOOK_LIFT,
    EXPLORE_DISTANCE_DEFAULT,
    EXPLORE_DISTANCE_MAX,
    EXPLORE_DISTANCE_MIN,
    EXPLORE_FOV,
    LOOK_HEIGHT,
    LOOK_X,
    LOOK_Z,
    OFFSET_X,
    OFFSET_Y,
    OFFSET_Z,
  } from './exploreRig'

  let cameraRef = $state<PerspectiveCamera>()
  /** Pulled back so the vale reads as a JRPG diorama, not a close third-person shot. */
  let distance = EXPLORE_DISTANCE_DEFAULT
  /** Soft follow anchor — camera + lookAt are rigid offsets from this, so framing never shears. */
  const follow = new Vector3(playerLive.x, walkHeight(playerLive.x, playerLive.z), playerLive.z)
  const explorePos = new Vector3()
  const exploreLook = new Vector3()
  const battlePos = new Vector3()
  const battleLook = new Vector3()
  const battleActionFocus = new Vector3()
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

  let converseBlend = 0
  let framed = false
  let posInitialized = false
  let impactSerial = combatImpact.serial
  let shakeElapsed = 0
  let shakeDuration = 0
  let shakeStrength = 0
  let battleBlend = 0
  /** Kept across soft-exit so board-fit eases out cleanly after mode → explore. */
  let lastBattleFocus: [number, number] | null = null
  let lastBattleFov = get(battleTuning).fov
  let battleFocusInitialized = false
  let surfaceCacheKey = ''
  let surfaceCache: BattleSurfaceCell[] | undefined
  let surfaceMedianY = 0

  function naturalBattleSurfaceCells(): BattleSurfaceCell[] | undefined {
    if (!hexBattleDriver.isActive()) return undefined
    const origin = hexBattleDriver.getOrigin()
    const radius = hexBattleDriver.getBoardRadius()
    const hexSize = hexBattleDriver.getHexSize()
    const blocked = hexBattleDriver.getBlockedCells()
    const key = `${origin.x},${origin.z},${origin.yaw ?? 0}:${radius}:${hexSize}:${blocked.map(hexKey).join('|')}`
    if (key === surfaceCacheKey) return surfaceCache

    const blockedKeys = new Set(blocked.map(hexKey))
    surfaceCacheKey = key
    surfaceCache = hexesWithin({ q: 0, r: 0 }, radius)
      .filter((hex) => !blockedKeys.has(hexKey(hex)))
      .map((hex) => {
        const world = hexToWorldXZ(hex, origin, hexSize)
        return { hex, y: walkHeight(world.x, world.z) }
      })
    const sortedY = surfaceCache.map((cell) => cell.y).sort((a, b) => a - b)
    surfaceMedianY = sortedY[Math.floor(sortedY.length / 2)] ?? walkHeight(origin.x, origin.z)
    return surfaceCache
  }

  function onWheel(event: WheelEvent) {
    const mode = get(cameraMode).kind
    if (mode === 'converse' || mode === 'battle') return
    event.preventDefault()
    distance = MathUtils.clamp(
      distance + event.deltaY * 0.012,
      EXPLORE_DISTANCE_MIN,
      EXPLORE_DISTANCE_MAX,
    )
  }

  onMount(() => {
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  })

  useTask((delta) => {
    if (!cameraRef) return

    const mode = get(cameraMode)
    const tuning = get(converseTuning)
    const battleTune = get(battleTuning)
    tickCombatLive(delta, $reducedMotion)
    // Converse owns the shot; battle suppresses open-world combat pull-in.
    const combatMix =
      mode.kind === 'converse' || mode.kind === 'battle' ? 0 : combatLive.intensity

    const wantConverse = mode.kind === 'converse' ? tuning.converseStrength : 0
    const wantBattle = mode.kind === 'battle' ? 1 : 0
    const blendEase = $reducedMotion ? 1 : 1 - Math.pow(0.038, delta)
    // ~2.5–3s settle so yaw/pitch land with prelude + march-in.
    const battleEase = $reducedMotion ? 1 : 1 - Math.pow(0.018, delta)
    converseBlend += (wantConverse - converseBlend) * blendEase
    battleBlend += (wantBattle - battleBlend) * battleEase

    if (mode.kind === 'battle') {
      lastBattleFocus = mode.focus
    }

    // Soft re-center on the board while holding the same isometric perch.
    const { x, z } =
      mode.kind === 'battle'
        ? { x: mode.focus[0], z: mode.focus[1] }
        : { x: playerLive.x, z: playerLive.z }
    const groundY = walkHeight(x, z)
    const followSnap =
      mode.kind === 'battle' || battleBlend > 0.02
        ? 0.022
        : combatMix > 0.02
          ? 0.022
          : 0.012
    const exploreEase = $reducedMotion ? 1 : 1 - Math.pow(followSnap, delta)
    follow.x += (x - follow.x) * exploreEase
    follow.y += (groundY - follow.y) * exploreEase
    follow.z += (z - follow.z) * exploreEase

    const combatDist = Math.max(COMBAT_DISTANCE_MIN, distance * COMBAT_DISTANCE_SCALE)
    const zoomedDist = MathUtils.lerp(distance, combatDist, combatMix)
    const lookLift = COMBAT_LOOK_LIFT * combatMix

    explorePos.set(
      follow.x + zoomedDist * OFFSET_X,
      follow.y + zoomedDist * OFFSET_Y,
      follow.z + zoomedDist * OFFSET_Z,
    )
    exploreLook.set(
      follow.x + LOOK_X,
      follow.y + LOOK_HEIGHT + lookLift,
      follow.z + LOOK_Z,
    )

    let battleFovTarget = lastBattleFov
    if (battleBlend > 0.01 && lastBattleFocus) {
      const aspect =
        canvas.clientWidth > 0 && canvas.clientHeight > 0
          ? canvas.clientWidth / canvas.clientHeight
          : cameraRef.aspect || 16 / 9
      const driverOrigin = hexBattleDriver.isActive()
        ? hexBattleDriver.getOrigin()
        : { x: lastBattleFocus[0], z: lastBattleFocus[1], yaw: 0 }
      const surfaceCells = naturalBattleSurfaceCells()
      const battleGround = surfaceCells?.length
        ? surfaceMedianY
        : walkHeight(driverOrigin.x, driverOrigin.z)
      let desiredFocusX = driverOrigin.x
      let desiredFocusZ = driverOrigin.z
      const battleUnits = hexBattleDriver.isActive()
        ? hexBattleDriver.mirrorSnapshot().filter((unit) => unit.alive)
        : []
      if (hexBattleDriver.isFighting()) {
        if (battleUnits.length) {
          desiredFocusX =
            battleUnits.reduce((sum, unit) => sum + unit.x, 0) / battleUnits.length
          desiredFocusZ =
            battleUnits.reduce((sum, unit) => sum + unit.z, 0) / battleUnits.length
          const dx = desiredFocusX - driverOrigin.x
          const dz = desiredFocusZ - driverOrigin.z
          const distance = Math.hypot(dx, dz)
          const maxDrift = hexBattleDriver.getHexSize() * 0.9
          if (distance > maxDrift) {
            desiredFocusX = driverOrigin.x + (dx / distance) * maxDrift
            desiredFocusZ = driverOrigin.z + (dz / distance) * maxDrift
          }
        }
      }
      if (!battleFocusInitialized) {
        battleActionFocus.set(driverOrigin.x, battleGround, driverOrigin.z)
        battleFocusInitialized = true
      }
      const actionEase = $reducedMotion ? 1 : 1 - Math.pow(0.025, delta)
      battleActionFocus.x += (desiredFocusX - battleActionFocus.x) * actionEase
      battleActionFocus.y += (battleGround - battleActionFocus.y) * actionEase
      battleActionFocus.z += (desiredFocusZ - battleActionFocus.z) * actionEase
      const frame = resolveBattleFrame({
        origin: driverOrigin,
        groundY: battleActionFocus.y,
        tuning: battleTune,
        aspect,
        radius: hexBattleDriver.isActive()
          ? hexBattleDriver.getBoardRadius()
          : undefined,
        hexSize: hexBattleDriver.isActive()
          ? hexBattleDriver.getHexSize()
          : undefined,
        surfaceCells,
        unitPoints: battleUnits.map((unit) => ({
          x: unit.x,
          y: walkHeight(unit.x, unit.z) + 4.5,
          z: unit.z,
        })),
        focusXZ: {
          x: battleActionFocus.x,
          z: battleActionFocus.z,
        },
      })
      lastBattleFov = frame.fov
      battleFovTarget = frame.fov
      battlePos.set(frame.pos.x, frame.pos.y, frame.pos.z)
      battleLook.set(frame.look.x, frame.look.y, frame.look.z)
      explorePos.lerp(battlePos, battleBlend)
      exploreLook.lerp(battleLook, battleBlend)
    } else if (battleBlend <= 0.01) {
      battleFocusInitialized = false
    }

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
        conversePos.y =
          converseLook.y + Math.sin(pitch) * flatDist + (conversePos.y - converseLook.y) * Math.cos(pitch)
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
      : 1 -
        Math.pow(
          mode.kind === 'converse'
            ? 0.045
            : mode.kind === 'battle' || battleBlend > 0.02
              ? 0.028
              : combatMix > 0.02
                ? 0.055
                : 0.04,
          delta,
        )
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
    const battleFov = MathUtils.lerp(exploreFov, battleFovTarget, battleBlend)
    const targetFov =
      mode.kind === 'converse' || converseBlend > 0.02
        ? tuning.fov
        : battleBlend > 0.02
          ? battleFov
          : exploreFov
    // Match combat release — FOV eases out slower than it punches in.
    const fovSnap = combatLive.engaged || combatMix > 0.85 ? 0.07 : combatMix > 0.02 ? 0.028 : 0.05
    cameraRef.fov += (targetFov - cameraRef.fov) * ($reducedMotion ? 1 : 1 - Math.pow(fovSnap, delta))
    cameraRef.updateProjectionMatrix()
    // Keep world/projection matrices current for HUD project() in later useTasks.
    cameraRef.updateMatrixWorld()

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
