import { describe, expect, it } from 'vitest'
import { HERO_RADIUS, isFree } from '../collision'
import { discoveries } from '../worldState'
import {
  WHISPERING_ASCENT,
  ascentPointAt,
  collisionCircles,
  landmarkColliderRadius,
  landmarkFootRadius,
  landmarks,
} from './sunmereVale'

/** True when the hero disc can stand somewhere inside the discovery ring. */
function discoveryHasFreeStand(x: number, z: number, radius: number) {
  if (isFree(x, z, HERO_RADIUS)) return true
  const rings = 10
  const spokes = 16
  for (let r = 1; r <= rings; r += 1) {
    const dist = (radius * r) / rings
    for (let s = 0; s < spokes; s += 1) {
      const angle = (s / spokes) * Math.PI * 2
      if (isFree(x + Math.cos(angle) * dist, z + Math.sin(angle) * dist, HERO_RADIUS)) {
        return true
      }
    }
  }
  return false
}

describe('landmark footprint colliders', () => {
  it('derives solid discs from measured mesh feet, not hand-inflated radii', () => {
    const tower = landmarks.find((l) => l.id === 'watchtower')!
    const house = landmarks.find((l) => l.id === 'house-west')!
    const market = landmarks.find((l) => l.id === 'market')!

    expect(landmarkColliderRadius(tower)!).toBeCloseTo(landmarkFootRadius(tower) * 0.92, 5)
    expect(landmarkColliderRadius(tower)!).toBeLessThan(2.7)
    expect(landmarkColliderRadius(house)!).toBeLessThan(2.2)
    expect(landmarkColliderRadius(market)!).toBeLessThan(2.0)

    // Silverrun is a dedicated procedural crossing, not a solid landmark prop.
    expect(landmarks.some((l) => l.id === 'silverrun-bridge')).toBe(false)
    expect(collisionCircles.some((c) => c.landmarkId === 'silverrun-bridge')).toBe(false)
  })

  it('keeps village yards walkable between house, well, and market', () => {
    // Bellkeeper stand + road junction — must not be swallowed by building discs.
    expect(isFree(-7, 9, HERO_RADIUS)).toBe(true)
    expect(isFree(-8, 11, HERO_RADIUS)).toBe(true)
    expect(isFree(-10, 8, HERO_RADIUS)).toBe(true)
    // Building centers stay solid.
    expect(isFree(-13, 10, HERO_RADIUS)).toBe(false)
    expect(isFree(-5, 11, HERO_RADIUS)).toBe(false)
    expect(isFree(-8, 7, HERO_RADIUS)).toBe(false)
  })

  it('keeps the pilgrim approach to Larkspur Watch standable', () => {
    // Art start + last free road samples before the tower disc.
    expect(isFree(18.8, -22, HERO_RADIUS)).toBe(true)
    expect(isFree(19.5, -19.0, HERO_RADIUS)).toBe(true)
    expect(isFree(19, -21, HERO_RADIUS)).toBe(true)
    expect(isFree(22, -22, HERO_RADIUS)).toBe(false)
  })

  it('keeps a hero-width route up the ascent and onto the mountain summit', () => {
    for (const along of [0, 0.15, 0.3, 0.47, 0.62, 0.78, 0.92, 1]) {
      const [x, z] = ascentPointAt(along)
      expect(isFree(x, z, HERO_RADIUS), `ascent ${along} should fit the hero`).toBe(true)
    }

    for (const [x, z] of [
      [WHISPERING_ASCENT.topX + 1.2, WHISPERING_ASCENT.topZ],
      [WHISPERING_ASCENT.topX, WHISPERING_ASCENT.topZ + 1.3],
      [WHISPERING_ASCENT.topX - 0.4, WHISPERING_ASCENT.topZ + 1.5],
    ] as Array<[number, number]>) {
      expect(isFree(x, z, HERO_RADIUS), `summit ${x},${z} should fit the hero`).toBe(true)
    }
  })
})

describe('discovery reachability', () => {
  it('leaves a free stand inside every discovery radius', () => {
    for (const discovery of discoveries) {
      const [x, z] = discovery.position
      expect(
        discoveryHasFreeStand(x, z, discovery.radius),
        `${discovery.id} should be approachable`,
      ).toBe(true)
    }
  })

  it('keeps the Bellkeeper stand clear of village colliders', () => {
    const villager = discoveries.find((d) => d.id === 'villager')!
    expect(villager.radius).toBeGreaterThan(HERO_RADIUS)
    expect(discoveryHasFreeStand(...villager.position, villager.radius)).toBe(true)
  })

  it('keeps Larkspur Watch larger than its collider plus hero', () => {
    const landmark = landmarks.find((l) => l.id === 'watchtower')!
    const discovery = discoveries.find((d) => d.id === 'watchtower')!
    const collider = landmarkColliderRadius(landmark)!
    expect(discovery.radius).toBeGreaterThan(collider + HERO_RADIUS)
  })
})
