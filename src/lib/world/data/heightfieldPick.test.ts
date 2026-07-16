import { describe, expect, it } from 'vitest'
import { intersectHeightfield } from './heightfieldPick'
import { SILVERRUN_BRIDGE, terrainHeight, walkHeight } from './sunmereVale'

describe('heightfield pick (camera ray vs walk surface)', () => {
  it('hits the walk surface under a pitched isometric-style camera ray', () => {
    // Soft isometric: SE of target, looking down toward (0, walkY, 0).
    const target = { x: 1, z: 20 }
    const groundY = walkHeight(target.x, target.z)
    const origin = {
      x: target.x + 17.28,
      y: groundY + 12,
      z: target.z + 21.12,
    }
    const direction = {
      x: target.x - origin.x,
      y: groundY - origin.y,
      z: target.z - origin.z,
    }
    const length = Math.hypot(direction.x, direction.y, direction.z)
    direction.x /= length
    direction.y /= length
    direction.z /= length

    const out = { x: 0, y: 0, z: 0 }
    expect(intersectHeightfield(origin, direction, out)).toBe(true)
    expect(out.x).toBeCloseTo(target.x, 1)
    expect(out.z).toBeCloseTo(target.z, 1)
    expect(out.y).toBeCloseTo(walkHeight(out.x, out.z), 3)
  })

  it('does not systematically miss elevated ground the way a Y=0 plane pick does', () => {
    // Aim at the watchtower mound (~Y=3). A flat Y=0 plane intersects far behind the hill.
    const target = { x: 22, z: -22 }
    const groundY = walkHeight(target.x, target.z)
    expect(groundY).toBeGreaterThan(2)

    const origin = {
      x: target.x + 17.28,
      y: groundY + 12,
      z: target.z + 21.12,
    }
    const direction = {
      x: target.x - origin.x,
      y: groundY - origin.y,
      z: target.z - origin.z,
    }
    const length = Math.hypot(direction.x, direction.y, direction.z)
    direction.x /= length
    direction.y /= length
    direction.z /= length

    const heightHit = { x: 0, y: 0, z: 0 }
    expect(intersectHeightfield(origin, direction, heightHit)).toBe(true)
    expect(Math.hypot(heightHit.x - target.x, heightHit.z - target.z)).toBeLessThan(1.5)

    // Flat plane Y=0: O + t D, Oy + t Dy = 0 → t = -Oy/Dy
    const tPlane = -origin.y / direction.y
    const planeX = origin.x + direction.x * tPlane
    const planeZ = origin.z + direction.z * tPlane
    const planeError = Math.hypot(planeX - target.x, planeZ - target.z)
    const heightError = Math.hypot(heightHit.x - target.x, heightHit.z - target.z)
    expect(planeError).toBeGreaterThan(4)
    expect(heightError).toBeLessThan(planeError * 0.35)
  })

  it('lands on the Silverrun deck, not the river cut', () => {
    const target = { x: SILVERRUN_BRIDGE.x, z: SILVERRUN_BRIDGE.z }
    const groundY = walkHeight(target.x, target.z)
    expect(groundY).toBeCloseTo(SILVERRUN_BRIDGE.deckY, 1)
    expect(groundY).toBeGreaterThan(terrainHeight(target.x, target.z) + 0.5)

    const origin = { x: target.x + 12, y: groundY + 10, z: target.z + 14 }
    const direction = {
      x: target.x - origin.x,
      y: groundY - origin.y,
      z: target.z - origin.z,
    }
    const length = Math.hypot(direction.x, direction.y, direction.z)
    direction.x /= length
    direction.y /= length
    direction.z /= length

    const out = { x: 0, y: 0, z: 0 }
    expect(intersectHeightfield(origin, direction, out)).toBe(true)
    expect(out.y).toBeCloseTo(SILVERRUN_BRIDGE.deckY, 1)
  })
})
