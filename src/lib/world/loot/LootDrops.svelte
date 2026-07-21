<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core'
  import { onDestroy } from 'svelte'
  import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    NearestFilter,
    Points,
    PointsMaterial,
    SRGBColorSpace,
    TextureLoader,
    type Texture,
  } from 'three'
  import { walkHeight } from '../data/sunmereVale'
  import { combatImpact } from '../combat'
  import { partyLive, playerLive, reducedMotion } from '../worldState'
  import { isLootCollectable } from '../battle'
  import { createPseudo3DSprite, type Pseudo3DSprite } from '../actors/pseudo3dSprite'
  import { LOOT_ITEMS, type LootItemId } from './catalog'
  import {
    getLootDrops,
    LOOT_BODY_BASE_Y,
    LOOT_CARD_HEIGHT,
    LOOT_SHOWCASE_SECONDS,
    resetLootRuntime,
    tickLoot,
    type LootDrop,
  } from './runtime'

  type LootHandle = {
    dropId: number
    itemId: LootItemId
    sprite: Pseudo3DSprite
  }

  const MAX_PARTICLES = 64
  const positions = new Float32Array(MAX_PARTICLES * 3)
  const colors = new Float32Array(MAX_PARTICLES * 3)
  const velocities = new Float32Array(MAX_PARTICLES * 3)
  const lives = new Float32Array(MAX_PARTICLES)
  const gold = new Color('#ffe29a')
  const mint = new Color('#9ef0c8')
  const rose = new Color('#ff8aa8')
  let particleCursor = 0
  let resetSerial = combatImpact.resetSerial

  for (let index = 0; index < MAX_PARTICLES; index += 1) {
    positions[index * 3 + 1] = -100
  }

  const geometry = new BufferGeometry()
  const positionAttribute = new BufferAttribute(positions, 3)
  const colorAttribute = new BufferAttribute(colors, 3)
  geometry.setAttribute('position', positionAttribute)
  geometry.setAttribute('color', colorAttribute)

  const material = new PointsMaterial({
    size: 0.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    sizeAttenuation: true,
    blending: AdditiveBlending,
    toneMapped: false,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 10

  const loader = new TextureLoader()
  const textures = new Map<LootItemId, Texture>()
  for (const item of LOOT_ITEMS) {
    const texture = loader.load(item.src)
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    texture.generateMipmaps = false
    texture.colorSpace = SRGBColorSpace
    textures.set(item.id, texture)
  }

  let handles = $state<LootHandle[]>([])
  const { camera } = useThrelte()

  function emitDissolve(x: number, y: number, z: number) {
    const count = $reducedMotion ? 5 : 16
    for (let particle = 0; particle < count; particle += 1) {
      const index = particleCursor++ % MAX_PARTICLES
      const offset = index * 3
      const angle = (particle / count) * Math.PI * 2 + Math.random() * 0.45
      const speed = 1.1 + Math.random() * 2.4
      positions[offset] = x + (Math.random() - 0.5) * 0.18
      positions[offset + 1] = y + (Math.random() - 0.5) * 0.16
      positions[offset + 2] = z + (Math.random() - 0.5) * 0.18
      velocities[offset] = Math.cos(angle) * speed
      velocities[offset + 1] = 0.9 + Math.random() * 2.2
      velocities[offset + 2] = Math.sin(angle) * speed
      lives[index] = 0.22 + Math.random() * 0.22
      const color = particle % 3 === 0 ? rose : particle % 2 === 0 ? mint : gold
      colors[offset] = color.r
      colors[offset + 1] = color.g
      colors[offset + 2] = color.b
    }
    positionAttribute.needsUpdate = true
    colorAttribute.needsUpdate = true
  }

  function ensureHandle(drop: LootDrop): LootHandle {
    let handle = handles.find((candidate) => candidate.dropId === drop.id)
    if (handle) return handle
    const map = textures.get(drop.itemId)
    if (!map) throw new Error(`Missing loot texture: ${drop.itemId}`)
    const sprite = createPseudo3DSprite({
      map,
      height: LOOT_CARD_HEIGHT,
      width: LOOT_CARD_HEIGHT,
      radius: 0.2,
      outlineColor: '#10120f',
      outlineOpacity: 1,
      outlineScale: 1.02,
      renderOrder: 6,
      bodyBaseY: LOOT_BODY_BASE_Y,
    })
    sprite.root.userData.loot = true
    handle = { dropId: drop.id, itemId: drop.itemId, sprite }
    handles = [...handles, handle]
    return handle
  }

  function pruneHandles(activeIds: Set<number>) {
    const kept: LootHandle[] = []
    for (const handle of handles) {
      if (activeIds.has(handle.dropId)) {
        kept.push(handle)
        continue
      }
      handle.sprite.root.removeFromParent()
      handle.sprite.material.dispose()
      handle.sprite.outlineMaterial.dispose()
      handle.sprite.depthMaterial.dispose()
      handle.sprite.mesh.geometry.dispose()
    }
    if (kept.length !== handles.length) handles = kept
  }

  useTask((delta) => {
    if (combatImpact.resetSerial !== resetSerial) {
      resetSerial = combatImpact.resetSerial
      resetLootRuntime()
      pruneHandles(new Set())
    }

    const heroGround = partyLive[0]?.y ?? walkHeight(playerLive.x, playerLive.z)
    const dissolved = tickLoot(
      delta,
      playerLive.x,
      playerLive.z,
      walkHeight,
      heroGround,
      { collectable: isLootCollectable() },
    )
    for (const event of dissolved) {
      emitDissolve(event.x, event.y, event.z)
    }

    const activeIds = new Set<number>()
    for (const drop of getLootDrops()) {
      activeIds.add(drop.id)
      const handle = ensureHandle(drop)
      const ground =
        drop.phase === 'showcase' || drop.phase === 'magnet'
          ? heroGround
          : walkHeight(drop.x, drop.z)
      const lift = Math.max(0, drop.y - ground)
      handle.sprite.plant(drop.x, drop.z, ground)
      handle.sprite.setBob(lift)

      let scale = 1
      if (drop.phase === 'spawning') {
        scale = 0.55 + Math.min(1, drop.age / 0.16) * 0.45
      } else if (drop.phase === 'magnet') {
        scale = 0.9 + Math.min(0.15, drop.magnetSpeed * 0.012)
      } else if (drop.phase === 'showcase') {
        const fade = Math.min(1, drop.showcaseAge / LOOT_SHOWCASE_SECONDS)
        // Hold full size, then shrink sharply in the last fifth before dissolve.
        scale = fade < 0.8 ? 1.05 : 1.05 * (1 - (fade - 0.8) / 0.2)
        handle.sprite.material.opacity = fade < 0.8 ? 1 : 1 - (fade - 0.8) / 0.2
        handle.sprite.outlineMaterial.opacity = handle.sprite.material.opacity
      } else {
        handle.sprite.material.opacity = 1
        handle.sprite.outlineMaterial.opacity = 1
      }
      handle.sprite.body.scale.set(Math.max(0.05, scale), Math.max(0.05, scale), 1)
      handle.sprite.faceCamera(camera.current)
    }
    pruneHandles(activeIds)

    let changed = false
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      if (lives[index] <= 0) continue
      lives[index] -= delta
      const offset = index * 3
      if (lives[index] <= 0) {
        positions[offset + 1] = -100
      } else {
        positions[offset] += velocities[offset] * delta
        positions[offset + 1] += velocities[offset + 1] * delta
        positions[offset + 2] += velocities[offset + 2] * delta
        velocities[offset] *= Math.pow(0.04, delta)
        velocities[offset + 1] -= 7.5 * delta
        velocities[offset + 2] *= Math.pow(0.04, delta)
      }
      changed = true
    }
    if (changed) positionAttribute.needsUpdate = true
  })

  onDestroy(() => {
    pruneHandles(new Set())
    geometry.dispose()
    material.dispose()
    for (const texture of textures.values()) texture.dispose()
  })
</script>

{#each handles as handle (handle.dropId)}
  <T is={handle.sprite.root} />
{/each}
<T is={points} />
