import { describe, expect, it } from 'vitest'
import {
  getLootDrops,
  LOOT_COLLECT_RADIUS,
  LOOT_MAGNET_DELAY,
  LOOT_POP_SECONDS,
  LOOT_SHOWCASE_SECONDS,
  resetLootRuntime,
  spawnLootBurst,
  tickLoot,
} from './runtime'

describe('loot runtime', () => {
  it('lands, magnets to the hero, showcases above the head, then dissolves', () => {
    resetLootRuntime()
    const surfaceY = () => 1
    let randomCalls = 0
    const random = () => {
      randomCalls += 1
      return (randomCalls % 7) / 7
    }

    const spawned = spawnLootBurst(0, 0, 'enemy-a', { random })
    expect(spawned).toHaveLength(1)
    expect(spawned[0].phase).toBe('spawning')

    tickLoot(LOOT_POP_SECONDS + 0.01, 10, 10, surfaceY, 1)
    expect(getLootDrops()[0].phase).toBe('grounded')
    expect(getLootDrops()[0].y).toBe(1)

    tickLoot(LOOT_MAGNET_DELAY + 0.01, 10, 10, surfaceY, 1)
    expect(getLootDrops()[0].phase).toBe('grounded')

    const near = getLootDrops()[0]
    tickLoot(0.02, near.x + LOOT_COLLECT_RADIUS * 0.5, near.z, surfaceY, 1)
    expect(getLootDrops()[0].phase).toBe('magnet')

    for (let step = 0; step < 40; step += 1) {
      tickLoot(0.05, near.x, near.z, surfaceY, 1)
      if (getLootDrops()[0]?.phase === 'showcase') break
    }
    expect(getLootDrops()[0]?.phase).toBe('showcase')

    const dissolved = tickLoot(LOOT_SHOWCASE_SECONDS + 0.01, near.x, near.z, surfaceY, 1)
    expect(dissolved).toHaveLength(1)
    expect(getLootDrops()).toHaveLength(0)
  })

  it('clears drops on reset', () => {
    resetLootRuntime()
    spawnLootBurst(1, 2, 'enemy-b', { random: () => 0.1 })
    expect(getLootDrops()).toHaveLength(1)
    resetLootRuntime()
    expect(getLootDrops()).toHaveLength(0)
  })

  it('keeps rewards grounded until collection is enabled', () => {
    resetLootRuntime()
    const surfaceY = () => 0
    const [drop] = spawnLootBurst(0, 0, 'enemy-c', { random: () => 0.2 })

    tickLoot(LOOT_POP_SECONDS + 0.01, 0, 0, surfaceY, 0, {
      collectable: false,
    })
    tickLoot(LOOT_MAGNET_DELAY + 0.1, drop.x, drop.z, surfaceY, 0, {
      collectable: false,
    })
    expect(getLootDrops()[0].phase).toBe('grounded')

    tickLoot(0.02, drop.x, drop.z, surfaceY, 0, { collectable: true })
    expect(getLootDrops()[0].phase).toBe('magnet')
  })
})
