<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import {
    Color,
    MathUtils,
    NearestFilter,
    Raycaster,
    SRGBColorSpace,
    Texture,
    TextureLoader,
    Vector2,
    Vector3,
  } from 'three'
  import {
    activeDialogue,
    completeNearby,
    dusk,
    introVisible,
    nearbyDiscovery,
    partyLive,
    playerLive,
    playerPosition,
    pulseCombat,
    reducedMotion,
    touchMove,
    updateNearby,
  } from '../worldState'
  import { walkHeight, onAscentLane, riverCenter, WATER_SURFACE_Y } from '../data/sunmereVale'
  import { intersectHeightfield } from '../data/heightfieldPick'
  import { HERO_RADIUS, moveWithCollision, overlapsRiver, resolveFreePosition } from '../collision'
  import { clearWaterDisturbanceUnit, pushWaterDisturbance } from '../river/riverDisturbance'
  import {
    createAttackState,
    attackAnimationDuration,
    combatDelta,
    consumeAbilitySlots,
    emitCombatAudio,
    findFocusTarget,
    getCombatants,
    getLivingEnemyColliders,
    LEADER_ATTACK_LOADOUT,
    moduleForSlot,
    pushAttackSwing,
    requestAbilitySlot,
    setCombatFocusTarget,
    tickAttack,
    tickAttackSwings,
    tryActivateSlot,
    type AttackSlotBinding,
  } from '../combat'
  import {
    FRAME_HEIGHT,
    facingForVelocity,
    facingRow,
    frameIndex,
    frameUv,
    motionForMovement,
    textureColumns,
    textureRows,
    type Facing,
    type Motion,
  } from './spriteSheet'
  import { createPseudo3DSprite, type Pseudo3DSprite } from './pseudo3dSprite'
  import { attackAnimationFor } from './attackAnimations'

  type HeroDefinition = {
    id: string
    idle: string
    walk: string
    /** Optional attack sheet — only the leader needs this for now. */
    attack?: string
    cardHeight: number
  }
  type HeroHandle = {
    sprite: Pseudo3DSprite
    textures: Record<Motion, Texture>
    id: string
    /** Gameplay feet on XZ. */
    x: number
    z: number
    /** World Y of feet — walkHeight when grounded, arc height while jumping. */
    footY: number
    yVelocity: number
    airborne: boolean
    /** Seconds before companions may auto-hop again (avoids slope bunny-spam). */
    stepJumpCooldown: number
    lastFacing: Facing
    motion: Motion
    motionElapsed: number
    /** Tracks water entry so the first step always stamps a wake. */
    wasFording: boolean
  }

  /**
   * Source cells are square, but the pitched camera foreshortens vertical cards.
   * Match createPseudo3DSprite's default so silhouettes read tall, not squat.
   */
  const CARD_ASPECT = 0.72
  const FEET_FROM_TOP = 19
  const TRAIL_STEP = 0.18
  const FOLLOWER_GAP = 9
  const TRAIL_LENGTH = FOLLOWER_GAP * 4 + 12
  const INITIAL_TRAIL_X = 0.63
  const INITIAL_TRAIL_Z = 0.78
  /** Peak hop ≈ 0.55 units — short, snappy pop. */
  const JUMP_SPEED = 6.8
  const GRAVITY = 42
  /** Lookahead / rise that counts as a terrain step companions should hop. */
  const STEP_LOOKAHEAD = 0.7
  const STEP_UP_RISE = 0.14
  const STEP_JUMP_COOLDOWN = 0.38
  /** Deliberate climb on the Whispering Ascent — slower feet, clearer step hops. */
  const ASCENT_SPEED_SCALE = 0.58
  const ASCENT_STEP_LOOKAHEAD = 0.55
  const ASCENT_STEP_UP_RISE = 0.1
  const ASCENT_STEP_JUMP_COOLDOWN = 0.42
  const ASCENT_JUMP_SPEED = 6.4

  const definitions: HeroDefinition[] = [
    {
      id: 'paladin',
      idle: '/assets/minifantasy/heroes/paladin/idle.png',
      walk: '/assets/minifantasy/heroes/paladin/walk.png',
      attack: '/assets/minifantasy/heroes/paladin/attack.png',
      cardHeight: 3.9,
    },
    {
      id: 'ranger',
      idle: '/assets/minifantasy/heroes/ranger/idle.png',
      walk: '/assets/minifantasy/heroes/ranger/walk.png',
      cardHeight: 3.9,
    },
    {
      id: 'wizard',
      idle: '/assets/minifantasy/heroes/wizard/idle.png',
      walk: '/assets/minifantasy/heroes/wizard/walk.png',
      cardHeight: 3.9,
    },
    {
      id: 'assassin',
      idle: '/assets/minifantasy/heroes/assassin/idle.png',
      walk: '/assets/minifantasy/heroes/assassin/walk.png',
      cardHeight: 3.9,
    },
  ]

  const leaderAttackLoadout: AttackSlotBinding[] = [...LEADER_ATTACK_LOADOUT]
  const leaderCombat = createAttackState()

  const loader = new TextureLoader()
  // The sprite form shader supplies contrast, edge light, and highlight rolloff;
  // these only provide the scene's ambient day/dusk color.
  const dayTint = new Color('#eee4d2')
  const duskTint = new Color('#c6a1b0')
  const keys = new Set<string>()
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const pointerHit = new Vector3()
  const clickTarget = new Vector3()
  const camForward = new Vector3()
  const camRight = new Vector3()
  const rayOrigin = new Vector3()
  const rayDirection = new Vector3()
  let hasClickTarget = false
  let elapsed = 0
  let publishAccumulator = 0
  let waterFxAccumulator = 0
  let waterIdleAccumulator = 0
  let focusedEnemyId: string | null = null
  let attackTargetId: string | null = null
  const FOCUS_RELEASE_PADDING = 0.7
  const FOCUS_LUNGE = 0.32
  /** How often we *try* to stamp; spacing in riverDisturbance does the real gating. */
  const WATER_FX_TRY_INTERVAL = 0.08
  const artVista = new URLSearchParams(window.location.search).get('art')
  const initialPosition = get(playerPosition)
  let leaderX = initialPosition[0]
  let leaderZ = initialPosition[1]
  let lastTrailX = leaderX
  let lastTrailZ = leaderZ
  const trail: Array<[number, number]> = Array.from({ length: TRAIL_LENGTH }, (_, index) => [
    leaderX + INITIAL_TRAIL_X * TRAIL_STEP * index,
    leaderZ + INITIAL_TRAIL_Z * TRAIL_STEP * index,
  ])
  const artMode = Boolean(artVista && artVista !== 'combat' && artVista !== 'trees')

  const { camera, canvas } = useThrelte()

  function loadTexture(url: string) {
    const texture = loader.load(url)
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    texture.generateMipmaps = false
    texture.colorSpace = SRGBColorSpace
    return texture
  }

  function trailPointFor(index: number) {
    return trail[Math.min(trail.length - 1, index * FOLLOWER_GAP)]
  }

  function createHero(definition: HeroDefinition, index: number): HeroHandle {
    const idle = loadTexture(definition.idle)
    const walk = loadTexture(definition.walk)
    const attack = definition.attack ? loadTexture(definition.attack) : idle
    const textures = {
      idle,
      walk,
      run: walk,
      attack,
    }
    const bodyBaseY =
      -((FRAME_HEIGHT - FEET_FROM_TOP) / FRAME_HEIGHT) * definition.cardHeight
    const sprite = createPseudo3DSprite({
      map: textures.idle,
      height: definition.cardHeight,
      width: definition.cardHeight * CARD_ASPECT,
      radius: HERO_RADIUS,
      bodyBaseY,
    })
    sprite.root.userData.id = definition.id
    sprite.root.userData.partyIndex = index
    sprite.root.userData.partyLeader = index === 0
    const [trailX, trailZ] = trailPointFor(index)
    const start = index === 0
      ? { x: leaderX, z: leaderZ }
      : resolveFreePosition(trailX, trailZ, HERO_RADIUS * 0.92)
    sprite.plant(start.x, start.z, walkHeight(start.x, start.z))

    return {
      sprite,
      textures,
      id: definition.id,
      x: start.x,
      z: start.z,
      footY: walkHeight(start.x, start.z),
      yVelocity: 0,
      airborne: false,
      stepJumpCooldown: 0,
      lastFacing: 'back-left',
      motion: 'idle',
      motionElapsed: 0,
      wasFording: false,
    }
  }

  const heroes = definitions.map(createHero)

  function updateSprite(handle: HeroHandle, motion: Motion, facing: Facing, time: number) {
    const texture = handle.textures[motion]
    handle.sprite.setMap(texture)
    const image = texture.image as HTMLImageElement | undefined
    const columns = image?.width ? textureColumns(image.width) : 1
    const rows = image?.height ? textureRows(image.height) : 1
    const uv = frameUv(frameIndex(time, columns, motion), columns, facingRow(facing), rows)
    texture.repeat.set(...uv.repeat)
    texture.offset.set(...uv.offset)
  }

  function plantHero(hero: HeroHandle, x: number, z: number) {
    hero.x = x
    hero.z = z
    hero.sprite.plant(x, z, hero.footY)
  }

  function startJump(hero: HeroHandle, speed = JUMP_SPEED) {
    if (hero.airborne) return
    hero.airborne = true
    hero.yVelocity = speed
  }

  /** Integrate vertical motion; call after XZ has been updated for this frame. */
  function integrateJump(hero: HeroHandle, delta: number) {
    const groundY = walkHeight(hero.x, hero.z)
    if (hero.airborne) {
      hero.footY += hero.yVelocity * delta
      hero.yVelocity -= GRAVITY * delta
      if (hero.footY <= groundY && hero.yVelocity <= 0) {
        hero.footY = groundY
        hero.yVelocity = 0
        hero.airborne = false
      }
    } else {
      hero.footY = groundY
    }
    hero.sprite.plant(hero.x, hero.z, hero.footY)
  }

  /** True when terrain ahead rises steeply enough that heroes should hop a tread. */
  function needsStepUpJump(x: number, z: number, dx: number, dz: number, onStairs: boolean) {
    const speed = Math.hypot(dx, dz)
    if (speed < 1e-4) return false
    const nx = dx / speed
    const nz = dz / speed
    const lookahead = onStairs ? ASCENT_STEP_LOOKAHEAD : STEP_LOOKAHEAD
    const riseThreshold = onStairs ? ASCENT_STEP_UP_RISE : STEP_UP_RISE
    const rise = walkHeight(x + nx * lookahead, z + nz * lookahead) - walkHeight(x, z)
    return rise >= riseThreshold
  }

  function resetTrail(x: number, z: number) {
    lastTrailX = x
    lastTrailZ = z
    trail.forEach((point, index) => {
      point[0] = x + INITIAL_TRAIL_X * TRAIL_STEP * index
      point[1] = z + INITIAL_TRAIL_Z * TRAIL_STEP * index
    })
  }

  function placePartyOnTrail() {
    heroes.forEach((hero, index) => {
      const [x, z] = trailPointFor(index)
      const position = index === 0
        ? { x: leaderX, z: leaderZ }
        : resolveFreePosition(x, z, HERO_RADIUS * 0.92)
      hero.airborne = false
      hero.yVelocity = 0
      hero.stepJumpCooldown = 0
      hero.footY = walkHeight(position.x, position.z)
      plantHero(hero, position.x, position.z)
      hero.motion = 'idle'
      hero.motionElapsed = 0
    })
  }

  function recordTrail(x: number, z: number) {
    let dx = x - lastTrailX
    let dz = z - lastTrailZ
    let distance = Math.hypot(dx, dz)

    while (distance >= TRAIL_STEP) {
      lastTrailX += (dx / distance) * TRAIL_STEP
      lastTrailZ += (dz / distance) * TRAIL_STEP
      trail.unshift([lastTrailX, lastTrailZ])
      trail.pop()
      dx = x - lastTrailX
      dz = z - lastTrailZ
      distance = Math.hypot(dx, dz)
    }
  }

  function advanceMotion(hero: HeroHandle, nextMotion: Motion, delta: number) {
    if (hero.motion === nextMotion) {
      hero.motionElapsed += delta
      return
    }
    hero.motion = nextMotion
    hero.motionElapsed = 0
  }

  function onKeyDown(event: KeyboardEvent) {
    keys.add(event.key.toLowerCase())
    if (artMode && ['1', '2', '3', '4', '5', '6'].includes(event.key)) {
      const locations: Record<string, [number, number]> = {
        '1': [-7, 9],
        '2': [6, -2],
        '3': [-17.1, -16],
        '4': [18.8, -22],
        '5': [-11.2, -17.0],
        '6': [-20, riverCenter(-20)],
      }
      const [x, z] = locations[event.key]
      leaderX = x
      leaderZ = z
      resetTrail(x, z)
      placePartyOnTrail()
      hasClickTarget = false
      playerLive.x = x
      playerLive.z = z
      for (let i = 0; i < partyLive.length; i += 1) {
        const slot = partyLive[i]
        const hero = heroes[i]
        if (!slot || !hero) continue
        slot.x = hero.x
        slot.y = hero.footY
        slot.z = hero.z
      }
      playerPosition.set([x, z])
      updateNearby(x, z)
      return
    }
    if (event.key === '1' && !get(activeDialogue)) {
      requestAbilitySlot(1)
      return
    }
    if (event.key === ' ') {
      event.preventDefault()
      if (get(activeDialogue)) return
      // Interact wins over jump when something is in range.
      if (get(nearbyDiscovery)) {
        completeNearby()
        return
      }
      startJump(heroes[0])
      return
    }
    if (event.key === 'Enter' || event.key.toLowerCase() === 'e') {
      event.preventDefault()
      if (get(activeDialogue)) return
      completeNearby()
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    keys.delete(event.key.toLowerCase())
  }

  function onPointerUp(event: PointerEvent) {
    // Touch travel is handled by the floating joystick; keep click-to-move for mouse.
    if (event.pointerType === 'touch') return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera.current)
    rayOrigin.copy(raycaster.ray.origin)
    rayDirection.copy(raycaster.ray.direction)
    if (!intersectHeightfield(rayOrigin, rayDirection, pointerHit)) return
    clickTarget.copy(pointerHit)
    hasClickTarget = true
    introVisible.set(false)
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerup', onPointerUp)
    }
  })

  useTask((delta) => {
    const eventDelta = delta
    delta = combatDelta(delta)
    elapsed += delta
    const combatants = getCombatants()
    const activeTarget = attackTargetId
      ? combatants.find((combatant) => combatant.id === attackTargetId && combatant.alive)
      : undefined
    if (attackTargetId && !activeTarget) attackTargetId = null

    if (!leaderCombat.active) {
      const module = moduleForSlot(leaderAttackLoadout, 1)
      const nearby =
        module?.delivery.kind === 'melee-arc'
          ? findFocusTarget(
              leaderX,
              leaderZ,
              'party',
              combatants,
              module.delivery.range + FOCUS_RELEASE_PADDING,
              focusedEnemyId ?? undefined,
            )
          : undefined
      focusedEnemyId = nearby?.id ?? null
    }
    setCombatFocusTarget(attackTargetId ?? focusedEnemyId)

    if (!get(activeDialogue)) {
      for (const slot of consumeAbilitySlots()) {
        const boundModule = moduleForSlot(leaderAttackLoadout, slot)
        const animation = boundModule
          ? attackAnimationFor(definitions[0].id, boundModule.id)
          : undefined
        const activated = tryActivateSlot(
          leaderCombat,
          leaderAttackLoadout,
          slot,
          animation,
        )
        if (activated) {
          const target =
            activated.delivery.kind === 'melee-arc'
              ? findFocusTarget(
                  leaderX,
                  leaderZ,
                  'party',
                  combatants,
                  activated.delivery.range,
                  focusedEnemyId ?? undefined,
                )
              : undefined
          attackTargetId = target?.id ?? null
          focusedEnemyId = attackTargetId ?? focusedEnemyId
          setCombatFocusTarget(attackTargetId ?? focusedEnemyId)
          if (target) {
            heroes[0].lastFacing = facingForVelocity(
              target.x - leaderX,
              target.z - leaderZ,
              heroes[0].lastFacing,
            )
          }
          emitCombatAudio('swing')
          pulseCombat()
        }
      }
    }
    const attackTick = tickAttack(leaderCombat, delta)
    tickAttackSwings(eventDelta)
    if (attackTick.hitModule) {
      pushAttackSwing(
        definitions[0].id,
        attackTick.hitModule.id,
        leaderX,
        leaderZ,
        heroes[0].lastFacing,
        attackTargetId ?? undefined,
      )
    }

    let inputRight = 0
    let inputForward = 0
    if (!get(activeDialogue) && !attackTick.movementLocked) {
      if (keys.has('a') || keys.has('arrowleft')) inputRight -= 1
      if (keys.has('d') || keys.has('arrowright')) inputRight += 1
      if (keys.has('w') || keys.has('arrowup')) inputForward += 1
      if (keys.has('s') || keys.has('arrowdown')) inputForward -= 1
      inputRight = Math.max(-1, Math.min(1, inputRight + touchMove.right))
      inputForward = Math.max(-1, Math.min(1, inputForward + touchMove.forward))
    }

    let moveX = 0
    let moveZ = 0

    if (get(activeDialogue) || attackTick.movementLocked) {
      hasClickTarget = false
    } else if (inputRight || inputForward) {
      hasClickTarget = false
      introVisible.set(false)
      camera.current.getWorldDirection(camForward)
      camForward.y = 0
      if (camForward.lengthSq() < 1e-6) camForward.set(0, 0, -1)
      else camForward.normalize()
      camRight.set(-camForward.z, 0, camForward.x)
      moveX = camRight.x * inputRight + camForward.x * inputForward
      moveZ = camRight.z * inputRight + camForward.z * inputForward
    } else if (hasClickTarget) {
      moveX = clickTarget.x - leaderX
      moveZ = clickTarget.z - leaderZ
      if (Math.hypot(moveX, moveZ) < 0.55) {
        hasClickTarget = false
        moveX = moveZ = 0
      }
    }

    const wantsToMove = Math.abs(moveX) + Math.abs(moveZ) > 0.01
    const wantsToRun = keys.has('shift')
    const enemyColliders = getLivingEnemyColliders()
    let leaderMovedX = 0
    let leaderMovedZ = 0

    if (wantsToMove) {
      const length = Math.hypot(moveX, moveZ)
      moveX /= length
      moveZ /= length
      const climbing = onAscentLane(leaderX, leaderZ, 0.35)
      const baseSpeed = wantsToRun && !climbing ? 8.4 : 6.1
      const speed = climbing ? baseSpeed * ASCENT_SPEED_SCALE : baseSpeed
      const stepX = moveX * speed * delta
      const stepZ = moveZ * speed * delta
      const previousX = leaderX
      const previousZ = leaderZ
      const next = moveWithCollision(
        leaderX,
        leaderZ,
        stepX,
        stepZ,
        HERO_RADIUS,
        enemyColliders,
      )
      leaderMovedX = next.x - leaderX
      leaderMovedZ = next.z - leaderZ
      leaderX = next.x
      leaderZ = next.z
      if (heroes[0].stepJumpCooldown > 0) heroes[0].stepJumpCooldown -= delta
      if (
        climbing &&
        heroes[0].stepJumpCooldown <= 0 &&
        needsStepUpJump(previousX, previousZ, leaderMovedX, leaderMovedZ, true)
      ) {
        startJump(heroes[0], ASCENT_JUMP_SPEED)
        heroes[0].stepJumpCooldown = ASCENT_STEP_JUMP_COOLDOWN
      }
    }

    const leaderMoving = Math.hypot(leaderMovedX, leaderMovedZ) > 0.001
    if (leaderMoving) recordTrail(leaderX, leaderZ)

    const lockedTarget = attackTargetId
      ? combatants.find((combatant) => combatant.id === attackTargetId && combatant.alive)
      : undefined
    const leaderFacing =
      lockedTarget && (attackTick.active || attackTick.hitModule)
        ? facingForVelocity(
            lockedTarget.x - leaderX,
            lockedTarget.z - leaderZ,
            heroes[0].lastFacing,
          )
        : facingForVelocity(leaderMovedX, leaderMovedZ, heroes[0].lastFacing)
    heroes[0].lastFacing = leaderFacing

    heroes[0].x = leaderX
    heroes[0].z = leaderZ
    integrateJump(heroes[0], delta)
    if (lockedTarget && leaderCombat.active && !$reducedMotion) {
      const progress = Math.min(
        1,
        leaderCombat.active.elapsed /
          Math.max(
            0.001,
            attackAnimationDuration(leaderCombat.active.animation),
          ),
      )
      const distance = Math.hypot(lockedTarget.x - leaderX, lockedTarget.z - leaderZ) || 1
      const lunge = Math.sin(progress * Math.PI) * FOCUS_LUNGE
      heroes[0].sprite.root.position.x +=
        ((lockedTarget.x - leaderX) / distance) * lunge
      heroes[0].sprite.root.position.z +=
        ((lockedTarget.z - leaderZ) / distance) * lunge
    }

    const cam = camera.current
    waterFxAccumulator += delta
    waterIdleAccumulator += delta
    const emitWaterFx = waterFxAccumulator > WATER_FX_TRY_INTERVAL
    if (emitWaterFx) waterFxAccumulator = 0
    const emitIdleRipple = waterIdleAccumulator > 1.1
    if (emitIdleRipple) waterIdleAccumulator = 0

    heroes.forEach((hero, index) => {
      let movedX = leaderMovedX
      let movedZ = leaderMovedZ
      const onStairs = onAscentLane(hero.x, hero.z, 0.35)

      if (index > 0) {
        const trailPoint = trailPointFor(index)
        const follow = 1 - Math.pow(0.002, delta)
        const previousX = hero.x
        const previousZ = hero.z
        const rawX = MathUtils.lerp(hero.x, trailPoint[0], follow)
        const rawZ = MathUtils.lerp(hero.z, trailPoint[1], follow)
        const safe = resolveFreePosition(
          rawX,
          rawZ,
          HERO_RADIUS * 0.92,
          enemyColliders,
        )
        movedX = safe.x - previousX
        movedZ = safe.z - previousZ
        hero.x = safe.x
        hero.z = safe.z
        if (hero.stepJumpCooldown > 0) hero.stepJumpCooldown -= delta
        if (
          hero.stepJumpCooldown <= 0 &&
          !overlapsRiver(hero.x, hero.z, HERO_RADIUS * 0.35) &&
          needsStepUpJump(previousX, previousZ, movedX, movedZ, onStairs)
        ) {
          startJump(hero, onStairs ? ASCENT_JUMP_SPEED : JUMP_SPEED)
          hero.stepJumpCooldown = onStairs ? ASCENT_STEP_JUMP_COOLDOWN : STEP_JUMP_COOLDOWN
        }
        integrateJump(hero, delta)
        hero.lastFacing = facingForVelocity(movedX, movedZ, hero.lastFacing)
      }

      const heroMoving = Math.hypot(movedX, movedZ) > 0.001
      // Followers lerp in tiny steps — while fording, inherit party motion so wakes match the leader.
      const waterMoving =
        heroMoving || (index > 0 && Math.hypot(leaderMovedX, leaderMovedZ) > 0.001)
      // Stairs force the walk cycle — no sprinting up the mist cliff.
      // Leader plays attack motion while a combat module is active.
      const motion =
        index === 0 && attackTick.active
          ? attackTick.active.motion
          : motionForMovement(heroMoving, wantsToRun && !onStairs)
      advanceMotion(hero, motion, delta)
      if (index === 0 && attackTick.active && leaderCombat.active) {
        // Render and gameplay sample the same authored timeline: when the
        // controller fires impactFrame, the matching sprite frame is visible.
        hero.motionElapsed = leaderCombat.active.elapsed
      }
      const fording = overlapsRiver(hero.x, hero.z, HERO_RADIUS * 0.35)
      const climbBob =
        onStairs && heroMoving && !hero.airborne && !$reducedMotion
          ? Math.sin(elapsed * 9.2 + index * 1.4) * 0.048
          : 0
      const bob =
        hero.airborne || $reducedMotion
          ? 0
          : Math.sin(elapsed * (motion === 'run' ? 11 : 7.5) + index * 1.2) *
              (heroMoving ? 0.035 : 0.006) +
            (fording ? Math.sin(elapsed * 5.4 + index * 1.7) * (heroMoving ? 0.028 : 0.012) : 0) +
            climbBob
      hero.sprite.setBob(bob)
      hero.sprite.faceCamera(cam)
      hero.sprite.material.color.lerp($dusk ? duskTint : dayTint, 1 - Math.pow(0.02, delta))
      updateSprite(hero, hero.motion, hero.lastFacing, hero.motionElapsed + index * 0.09)

      if (!fording) {
        if (hero.wasFording) clearWaterDisturbanceUnit(hero.id)
        hero.wasFording = false
        return
      }
      // Feet sit in the carved bowl below the visual water plane — scale wakes by depth.
      const enteredWater = !hero.wasFording
      hero.wasFording = true
      const fordDepth = Math.max(0, WATER_SURFACE_Y - hero.footY)
      const depthScale = 0.7 + Math.min(1.15, fordDepth * 2.4)
      if (enteredWater) {
        pushWaterDisturbance(
          hero.x,
          hero.z,
          (waterMoving ? 1 : 0.85) * depthScale,
          fordDepth,
          hero.id,
          { force: true },
        )
      } else if (waterMoving && emitWaterFx) {
        pushWaterDisturbance(
          hero.x,
          hero.z,
          (wantsToRun ? 1 : 0.78) * depthScale,
          fordDepth,
          hero.id,
        )
      } else if (emitIdleRipple) {
        pushWaterDisturbance(hero.x, hero.z, 0.28 * depthScale, fordDepth, hero.id)
      }
    })

    playerLive.x = leaderX
    playerLive.z = leaderZ
    for (let i = 0; i < heroes.length; i += 1) {
      const slot = partyLive[i]
      if (!slot) continue
      slot.x = heroes[i].x
      slot.y = heroes[i].footY
      slot.z = heroes[i].z
    }

    publishAccumulator += delta
    if (publishAccumulator > 0.08) {
      publishAccumulator = 0
      playerPosition.set([leaderX, leaderZ])
      updateNearby(leaderX, leaderZ)
    }
    if (!leaderCombat.active) attackTargetId = null
  })
</script>

{#each heroes as hero (hero.sprite.root.uuid)}
  <T is={hero.sprite.root} />
{/each}
