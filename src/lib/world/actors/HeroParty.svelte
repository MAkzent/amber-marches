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
    completeNearby,
    dusk,
    introVisible,
    playerLive,
    playerPosition,
    reducedMotion,
    touchMove,
    updateNearby,
  } from '../worldState'
  import { walkHeight } from '../data/sunmereVale'
  import { intersectHeightfield } from '../data/heightfieldPick'
  import { HERO_RADIUS, moveWithCollision, resolveFreePosition } from '../collision'
  import {
    FRAME_HEIGHT,
    FRAME_WIDTH,
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

  type HeroDefinition = { id: string; idle: string; walk: string; cardHeight: number }
  type HeroHandle = {
    sprite: Pseudo3DSprite
    textures: Record<Motion, Texture>
    /** Gameplay feet on XZ — Y always comes from walkHeight via sprite.plant. */
    x: number
    z: number
    lastFacing: Facing
    motion: Motion
    motionElapsed: number
  }

  /** Minifantasy cells are square; visible feet end at source Y=19 in every sheet. */
  const FRAME_ASPECT = FRAME_WIDTH / FRAME_HEIGHT
  const FEET_FROM_TOP = 19
  const TRAIL_STEP = 0.18
  const FOLLOWER_GAP = 9
  const TRAIL_LENGTH = FOLLOWER_GAP * 4 + 12
  const INITIAL_TRAIL_X = 0.63
  const INITIAL_TRAIL_Z = 0.78

  const definitions: HeroDefinition[] = [
    {
      id: 'paladin',
      idle: '/assets/minifantasy/heroes/paladin/idle.png',
      walk: '/assets/minifantasy/heroes/paladin/walk.png',
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
      id: 'bard',
      idle: '/assets/minifantasy/heroes/bard/idle.png',
      walk: '/assets/minifantasy/heroes/bard/walk.png',
      cardHeight: 3.9,
    },
  ]

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
  const artMode = Boolean(artVista)

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
    const textures = {
      idle,
      walk,
      run: walk,
    }
    const bodyBaseY =
      -((FRAME_HEIGHT - FEET_FROM_TOP) / FRAME_HEIGHT) * definition.cardHeight
    const sprite = createPseudo3DSprite({
      map: textures.idle,
      height: definition.cardHeight,
      width: definition.cardHeight * FRAME_ASPECT,
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
      x: start.x,
      z: start.z,
      lastFacing: 'back-left',
      motion: 'idle',
      motionElapsed: 0,
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
    hero.sprite.plant(x, z, walkHeight(x, z))
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
    if (artMode && ['1', '2', '3', '4'].includes(event.key)) {
      const locations: Record<string, [number, number]> = {
        '1': [-7, 9],
        '2': [6, -2],
        '3': [-17.1, -16],
        '4': [18.8, -22],
      }
      const [x, z] = locations[event.key]
      leaderX = x
      leaderZ = z
      resetTrail(x, z)
      placePartyOnTrail()
      hasClickTarget = false
      playerLive.x = x
      playerLive.z = z
      playerPosition.set([x, z])
      updateNearby(x, z)
    }
    if (event.key === 'Enter' || event.key.toLowerCase() === 'e' || event.key === ' ') {
      event.preventDefault()
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
    elapsed += delta
    let inputRight = 0
    let inputForward = 0
    if (keys.has('a') || keys.has('arrowleft')) inputRight -= 1
    if (keys.has('d') || keys.has('arrowright')) inputRight += 1
    if (keys.has('w') || keys.has('arrowup')) inputForward += 1
    if (keys.has('s') || keys.has('arrowdown')) inputForward -= 1
    inputRight = Math.max(-1, Math.min(1, inputRight + touchMove.right))
    inputForward = Math.max(-1, Math.min(1, inputForward + touchMove.forward))

    let moveX = 0
    let moveZ = 0

    if (inputRight || inputForward) {
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
    let leaderMovedX = 0
    let leaderMovedZ = 0

    if (wantsToMove) {
      const length = Math.hypot(moveX, moveZ)
      moveX /= length
      moveZ /= length
      const speed = wantsToRun ? 8.4 : 6.1
      const stepX = moveX * speed * delta
      const stepZ = moveZ * speed * delta
      const next = moveWithCollision(leaderX, leaderZ, stepX, stepZ, HERO_RADIUS)
      leaderMovedX = next.x - leaderX
      leaderMovedZ = next.z - leaderZ
      leaderX = next.x
      leaderZ = next.z
    }

    const leaderMoving = Math.hypot(leaderMovedX, leaderMovedZ) > 0.001
    if (leaderMoving) recordTrail(leaderX, leaderZ)

    const leaderFacing = facingForVelocity(leaderMovedX, leaderMovedZ, heroes[0].lastFacing)
    heroes[0].lastFacing = leaderFacing

    plantHero(heroes[0], leaderX, leaderZ)

    const cam = camera.current
    heroes.forEach((hero, index) => {
      let movedX = leaderMovedX
      let movedZ = leaderMovedZ

      if (index > 0) {
        const trailPoint = trailPointFor(index)
        const follow = 1 - Math.pow(0.002, delta)
        const previousX = hero.x
        const previousZ = hero.z
        const rawX = MathUtils.lerp(hero.x, trailPoint[0], follow)
        const rawZ = MathUtils.lerp(hero.z, trailPoint[1], follow)
        const safe = resolveFreePosition(rawX, rawZ, HERO_RADIUS * 0.92)
        plantHero(hero, safe.x, safe.z)
        movedX = hero.x - previousX
        movedZ = hero.z - previousZ
        hero.lastFacing = facingForVelocity(movedX, movedZ, hero.lastFacing)
      }

      const heroMoving = Math.hypot(movedX, movedZ) > 0.001
      const motion = motionForMovement(heroMoving, wantsToRun)
      advanceMotion(hero, motion, delta)
      const bob = $reducedMotion
        ? 0
        : Math.sin(elapsed * (motion === 'run' ? 11 : 7.5) + index * 1.2) *
          (heroMoving ? 0.035 : 0.006)
      hero.sprite.setBob(bob)
      hero.sprite.faceCamera(cam)
      hero.sprite.material.color.lerp($dusk ? duskTint : dayTint, 1 - Math.pow(0.02, delta))
      updateSprite(hero, hero.motion, hero.lastFacing, hero.motionElapsed + index * 0.09)
    })

    playerLive.x = leaderX
    playerLive.z = leaderZ

    publishAccumulator += delta
    if (publishAccumulator > 0.08) {
      publishAccumulator = 0
      playerPosition.set([leaderX, leaderZ])
      updateNearby(leaderX, leaderZ)
    }
  })
</script>

{#each heroes as hero (hero.sprite.root.uuid)}
  <T is={hero.sprite.root} />
{/each}
