import { LOOT_ITEMS, rollLootItem, type LootItemId } from './catalog'

export type LootPhase = 'spawning' | 'grounded' | 'magnet' | 'showcase'

export type LootDrop = {
  id: number
  itemId: LootItemId
  sourceId: string
  /** Origin where the enemy died. */
  originX: number
  originZ: number
  /** Settled ground position after the pop arc. */
  targetX: number
  targetZ: number
  x: number
  y: number
  z: number
  phase: LootPhase
  age: number
  /** Elapsed time while grounded (for magnet delay + bob). */
  groundAge: number
  /** Elapsed time while hovering above the hero's head. */
  showcaseAge: number
  magnetSpeed: number
}

export type LootCollectEvent = {
  id: number
  itemId: LootItemId
  x: number
  y: number
  z: number
}

/** Pop arc duration before the item rests on the ground. */
export const LOOT_POP_SECONDS = 0.32
/** Delay after landing before the magnet may engage. */
export const LOOT_MAGNET_DELAY = 0.18
/** Hero proximity that starts the magnet pull. */
export const LOOT_MAGNET_RADIUS = 2.55
/** Distance at which the item reaches the hero and begins the head showcase. */
export const LOOT_COLLECT_RADIUS = 0.48
/** World-space card size for loot sprites. */
export const LOOT_CARD_HEIGHT = 1.075
/**
 * 16×16 loot cells keep ~4px transparent padding under the art.
 * Sink the card so the visible pixels sit on the walk surface.
 */
export const LOOT_BODY_BASE_Y = -(4 / 16) * LOOT_CARD_HEIGHT
/** Seconds after a death animation starts before loot spills. */
export const LOOT_DROP_AFTER_DEATH = 0.3
/** How long the item hovers above the hero before dissolving. */
export const LOOT_SHOWCASE_SECONDS = 0.51
/**
 * Height above the hero's feet for the head showcase.
 * Matches the hero card top: cardHeight 3.9 with feet at 19/32 from the top
 * → 3.9 * (19/32) ≈ 2.32, plus a tiny gap.
 */
export const LOOT_HEAD_OFFSET = 2.4

const drops: LootDrop[] = []
let nextLootId = 1

export function getLootDrops(): readonly LootDrop[] {
  return drops
}

export function clearLootDrops() {
  drops.length = 0
}

function scatterTarget(originX: number, originZ: number, random: () => number) {
  const angle = random() * Math.PI * 2
  const dist = 0.35 + random() * 0.55
  return {
    x: originX + Math.cos(angle) * dist,
    z: originZ + Math.sin(angle) * dist,
  }
}

export function spawnLootBurst(
  originX: number,
  originZ: number,
  sourceId: string,
  options?: { count?: number; random?: () => number },
): LootDrop[] {
  const random = options?.random ?? Math.random
  const count = options?.count ?? 1
  const spawned: LootDrop[] = []

  for (let index = 0; index < count; index += 1) {
    const item = rollLootItem(random)
    const target = scatterTarget(originX, originZ, random)
    const drop: LootDrop = {
      id: nextLootId++,
      itemId: item.id,
      sourceId,
      originX,
      originZ,
      targetX: target.x,
      targetZ: target.z,
      x: originX,
      y: 0,
      z: originZ,
      phase: 'spawning',
      age: 0,
      groundAge: 0,
      showcaseAge: 0,
      magnetSpeed: 0,
    }
    drops.push(drop)
    spawned.push(drop)
  }

  return spawned
}

function easeOutCubic(t: number) {
  const u = 1 - Math.min(1, Math.max(0, t))
  return 1 - u * u * u
}

export function tickLoot(
  delta: number,
  heroX: number,
  heroZ: number,
  surfaceY: (x: number, z: number) => number,
  heroSurfaceY?: number,
): LootCollectEvent[] {
  const collected: LootCollectEvent[] = []

  for (let index = drops.length - 1; index >= 0; index -= 1) {
    const drop = drops[index]
    drop.age += delta

    if (drop.phase === 'spawning') {
      const t = Math.min(1, drop.age / LOOT_POP_SECONDS)
      const eased = easeOutCubic(t)
      drop.x = drop.originX + (drop.targetX - drop.originX) * eased
      drop.z = drop.originZ + (drop.targetZ - drop.originZ) * eased
      const ground = surfaceY(drop.x, drop.z)
      drop.y = ground + Math.sin(t * Math.PI) * 0.55
      if (t >= 1) {
        drop.phase = 'grounded'
        drop.groundAge = 0
        drop.x = drop.targetX
        drop.z = drop.targetZ
        drop.y = surfaceY(drop.x, drop.z)
      }
      continue
    }

    if (drop.phase === 'grounded') {
      drop.groundAge += delta
      drop.y = surfaceY(drop.x, drop.z)
      if (drop.groundAge >= LOOT_MAGNET_DELAY) {
        const dist = Math.hypot(heroX - drop.x, heroZ - drop.z)
        if (dist <= LOOT_MAGNET_RADIUS) {
          drop.phase = 'magnet'
          drop.magnetSpeed = 4.2
        }
      }
      continue
    }

    if (drop.phase === 'magnet') {
      const dx = heroX - drop.x
      const dz = heroZ - drop.z
      const dist = Math.hypot(dx, dz) || 0.0001
      drop.magnetSpeed = Math.min(14, drop.magnetSpeed + delta * 18)
      const step = Math.min(dist, drop.magnetSpeed * delta)
      drop.x += (dx / dist) * step
      drop.z += (dz / dist) * step
      const ground = heroSurfaceY ?? surfaceY(drop.x, drop.z)
      const headY = ground + LOOT_HEAD_OFFSET
      // Rise toward the head as we close in.
      const approach = 1 - Math.min(1, dist / LOOT_MAGNET_RADIUS)
      drop.y = ground + 0.35 + (headY - ground - 0.35) * approach
      if (dist <= LOOT_COLLECT_RADIUS) {
        drop.phase = 'showcase'
        drop.showcaseAge = 0
        drop.x = heroX
        drop.z = heroZ
        drop.y = headY
      }
      continue
    }

    if (drop.phase === 'showcase') {
      drop.showcaseAge += delta
      const ground = heroSurfaceY ?? surfaceY(heroX, heroZ)
      drop.x = heroX
      drop.z = heroZ
      drop.y = ground + LOOT_HEAD_OFFSET + Math.sin(drop.showcaseAge * 5.5) * 0.08
      if (drop.showcaseAge >= LOOT_SHOWCASE_SECONDS) {
        collected.push({
          id: drop.id,
          itemId: drop.itemId,
          x: drop.x,
          y: drop.y,
          z: drop.z,
        })
        drops.splice(index, 1)
      }
    }
  }

  return collected
}

export function resetLootRuntime() {
  drops.length = 0
  nextLootId = 1
}

/** Test helper — exposes catalog size without re-exporting internals. */
export function lootCatalogSize() {
  return LOOT_ITEMS.length
}
