import { describe, expect, it } from 'vitest'
import {
  HERO_RADIUS,
  isFree,
  moveWithCollision,
  overlapsRiver,
  resolveFreePosition,
  separateFromColliders,
  worldColliders,
} from './collision'
import {
  SILVERRUN_BRIDGE,
  bridgeDeckBlend,
  collisionCircles,
  onBridgeDeck,
  terrainHeight,
  walkHeight,
} from './data/sunmereVale'

describe('hero collision', () => {
  it('includes landmark and scenery colliders', () => {
    expect(worldColliders.length).toBeGreaterThan(collisionCircles.length)
  })

  it('keeps the bridge crossing open for the hero disc', () => {
    expect(isFree(6, -2, HERO_RADIUS)).toBe(true)
    expect(isFree(-20, -2, HERO_RADIUS)).toBe(false)
  })

  it('uses the walkHeight deck ellipse for the river gate (not a raw X strip)', () => {
    expect(overlapsRiver(SILVERRUN_BRIDGE.x, SILVERRUN_BRIDGE.z, HERO_RADIUS)).toBe(false)
    // Past the deck ellipse in +X but still inside the river band — must block.
    // (Old X-strip gate treated |x-6|<~3 as bridge and incorrectly allowed this.)
    const offDeckX = SILVERRUN_BRIDGE.x + SILVERRUN_BRIDGE.radiusX + 0.2
    const riverZ = SILVERRUN_BRIDGE.z
    expect(onBridgeDeck(offDeckX, riverZ)).toBe(false)
    expect(overlapsRiver(offDeckX, riverZ, HERO_RADIUS)).toBe(true)
  })

  it('keeps walkHeight lift and collision gate on the same ellipse', () => {
    const samples: Array<[number, number]> = [
      [6, -2],
      [8, -2],
      [6, -3.5],
      [9.2, -2],
    ]
    for (const [x, z] of samples) {
      const blend = bridgeDeckBlend(x, z)
      if (blend > 0.15) {
        expect(overlapsRiver(x, z, 0)).toBe(false)
        expect(walkHeight(x, z)).toBeGreaterThan(terrainHeight(x, z) + 0.05)
      }
    }
  })

  it('blocks the hero footprint against landmark buildings', () => {
    const house = collisionCircles[0]
    expect(isFree(house.x, house.z, HERO_RADIUS)).toBe(false)
  })

  it('slides along a circle instead of sticking', () => {
    const house = collisionCircles[0]
    const startX = house.x + house.radius + HERO_RADIUS + 0.02
    const startZ = house.z
    const next = moveWithCollision(startX, startZ, -1.2, 0.8, HERO_RADIUS)
    expect(next.x).toBeGreaterThan(house.x + house.radius + HERO_RADIUS - 0.05)
    expect(Math.abs(next.z - startZ)).toBeGreaterThan(0.2)
  })

  it('separates an overlapping disc out of a collider', () => {
    const house = collisionCircles[0]
    const separated = separateFromColliders(house.x + 0.2, house.z, HERO_RADIUS)
    expect(Math.hypot(separated.x - house.x, separated.z - house.z)).toBeGreaterThanOrEqual(
      house.radius + HERO_RADIUS - 1e-4,
    )
  })

  it('resolves followers out of the river and buildings', () => {
    const freedRiver = resolveFreePosition(-20, -2, HERO_RADIUS)
    expect(overlapsRiver(freedRiver.x, freedRiver.z, HERO_RADIUS)).toBe(false)

    const house = collisionCircles[0]
    const freedHouse = resolveFreePosition(house.x, house.z, HERO_RADIUS)
    expect(Math.hypot(freedHouse.x - house.x, freedHouse.z - house.z)).toBeGreaterThanOrEqual(
      house.radius + HERO_RADIUS - 1e-4,
    )
  })

  it('keeps the hero out of the visual river bank bowl', () => {
    // Bank mesh half-width ≈ 3.7; collision must cover it.
    expect(overlapsRiver(-8, 0, HERO_RADIUS)).toBe(true)
    expect(isFree(-8, 0, HERO_RADIUS)).toBe(false)
  })
})
