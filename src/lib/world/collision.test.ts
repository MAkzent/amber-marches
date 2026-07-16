import { describe, expect, it } from 'vitest'
import {
  HERO_RADIUS,
  isFree,
  moveWithCollision,
  overlapsRiver,
  resolveFreePosition,
  riverBlocksMovement,
  separateFromColliders,
  worldColliders,
} from './collision'
import {
  SILVERRUN_BRIDGE,
  bridgeDeckBlend,
  collisionCircles,
  onBridgeDeck,
  riverCenter,
  sampleRiverAxis,
  terrainHeight,
  walkHeight,
} from './data/sunmereVale'

describe('hero collision', () => {
  it('includes landmark and scenery colliders', () => {
    expect(worldColliders.length).toBeGreaterThan(collisionCircles.length)
  })

  it('keeps the bridge and authored ford open while deep water blocks', () => {
    expect(isFree(6, -2, HERO_RADIUS)).toBe(true)
    expect(isFree(-20, -2, HERO_RADIUS)).toBe(true)
    expect(isFree(-8, riverCenter(-8), HERO_RADIUS)).toBe(false)
  })

  it('walks from dry bank through the ford to the opposite bank', () => {
    const ford = sampleRiverAxis(-20)
    const startOffset = ford.waterHalfWidth + HERO_RADIUS + 0.35
    let x = ford.x - ford.normalX * startOffset
    let z = ford.centerZ - ford.normalZ * startOffset

    for (let step = 0; step < 40; step += 1) {
      const next = moveWithCollision(
        x,
        z,
        ford.normalX * 0.24,
        ford.normalZ * 0.24,
        HERO_RADIUS,
      )
      x = next.x
      z = next.z
    }

    const crossed = (x - ford.x) * ford.normalX + (z - ford.centerZ) * ford.normalZ
    expect(crossed).toBeGreaterThan(ford.waterHalfWidth + 0.2)
    expect(riverBlocksMovement(x, z, HERO_RADIUS)).toBe(false)
  })

  it('emits splash FX in wadable water, excluding bridge and deep core', () => {
    expect(overlapsRiver(SILVERRUN_BRIDGE.x, SILVERRUN_BRIDGE.z, HERO_RADIUS)).toBe(false)
    expect(overlapsRiver(-20, riverCenter(-20), HERO_RADIUS)).toBe(true)
    // Outer shelf away from the ford / bridge still splashes.
    const shelfAxis = sampleRiverAxis(-8)
    const shelf = {
      x: shelfAxis.x,
      z: shelfAxis.centerZ + Math.sign(shelfAxis.normalZ || 1) * shelfAxis.waterHalfWidth * 0.75,
    }
    expect(overlapsRiver(shelf.x, shelf.z, HERO_RADIUS * 0.35)).toBe(true)
    expect(riverBlocksMovement(shelf.x, shelf.z, HERO_RADIUS)).toBe(false)
    // Step off across the deck into deep water.
    const acrossX = -SILVERRUN_BRIDGE.axisZ
    const acrossZ = SILVERRUN_BRIDGE.axisX
    const offX = SILVERRUN_BRIDGE.x + acrossX * (SILVERRUN_BRIDGE.radiusZ + 0.35)
    const offZ = SILVERRUN_BRIDGE.z + acrossZ * (SILVERRUN_BRIDGE.radiusZ + 0.35)
    expect(onBridgeDeck(offX, offZ)).toBe(false)
    expect(overlapsRiver(offX, offZ, HERO_RADIUS)).toBe(false)
    expect(riverBlocksMovement(offX, offZ, HERO_RADIUS)).toBe(true)
  })

  it('allows walking the river edge shelf until the deep core', () => {
    const axis = sampleRiverAxis(-8)
    const shelfDist = axis.waterHalfWidth * 0.72
    const shelfX = axis.x
    const shelfZ = axis.centerZ + Math.sign(axis.normalZ || 1) * shelfDist
    expect(isFree(shelfX, shelfZ, HERO_RADIUS)).toBe(true)
    expect(riverBlocksMovement(axis.x, axis.centerZ, HERO_RADIUS)).toBe(true)
  })

  it('does not twitch-shove when walking the shelf toward deep water', () => {
    const axis = sampleRiverAxis(-8)
    const side = Math.sign(axis.normalZ || 1)
    let x = axis.x
    let z = axis.centerZ + side * axis.waterHalfWidth * 0.78
    const towardDeep = -side * 0.18
    for (let step = 0; step < 24; step += 1) {
      const next = moveWithCollision(x, z, 0, towardDeep, HERO_RADIUS)
      // Soft wall: never jump farther than the step plus a tiny clamp.
      expect(Math.abs(next.z - z)).toBeLessThan(0.22)
      x = next.x
      z = next.z
    }
    expect(riverBlocksMovement(x, z, HERO_RADIUS)).toBe(false)
    expect(Math.abs(z - axis.centerZ)).toBeGreaterThan(
      axis.waterHalfWidth * 0.52 - 0.05,
    )
  })

  it('keeps wading FX off the dry shore lip', () => {
    const axis = sampleRiverAxis(-20)
    const dryZ = axis.centerZ + Math.sign(axis.normalZ || 1) * (axis.waterHalfWidth + 0.35)
    expect(overlapsRiver(axis.x, dryZ, HERO_RADIUS)).toBe(false)
  })

  it('keeps walkHeight lift on the oriented deck', () => {
    const samples: Array<[number, number]> = [
      [SILVERRUN_BRIDGE.x, SILVERRUN_BRIDGE.z],
      [
        SILVERRUN_BRIDGE.x + SILVERRUN_BRIDGE.axisX * 1.2,
        SILVERRUN_BRIDGE.z + SILVERRUN_BRIDGE.axisZ * 1.2,
      ],
      [
        SILVERRUN_BRIDGE.x - SILVERRUN_BRIDGE.axisX * 1.2,
        SILVERRUN_BRIDGE.z - SILVERRUN_BRIDGE.axisZ * 1.2,
      ],
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

  it('resolves followers through the river but out of buildings', () => {
    const freedRiver = resolveFreePosition(-20, -2, HERO_RADIUS)
    expect(overlapsRiver(freedRiver.x, freedRiver.z, HERO_RADIUS)).toBe(true)
    expect(isFree(freedRiver.x, freedRiver.z, HERO_RADIUS)).toBe(true)

    const house = collisionCircles[0]
    const freedHouse = resolveFreePosition(house.x, house.z, HERO_RADIUS)
    expect(Math.hypot(freedHouse.x - house.x, freedHouse.z - house.z)).toBeGreaterThanOrEqual(
      house.radius + HERO_RADIUS - 1e-4,
    )
  })

  it('rejects movement into deep water and leaves the hero on the bank', () => {
    const z = riverCenter(-8)
    expect(overlapsRiver(-8, z, HERO_RADIUS)).toBe(false)
    expect(isFree(-8, z, HERO_RADIUS)).toBe(false)
    const start = { x: -8, z: z + 4.4 }
    const moved = moveWithCollision(start.x, start.z, 0, -2.2, HERO_RADIUS)
    expect(riverBlocksMovement(moved.x, moved.z, HERO_RADIUS)).toBe(false)
  })
})
