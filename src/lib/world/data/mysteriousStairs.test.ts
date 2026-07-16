import { describe, expect, it } from 'vitest'
import {
  ASCENT_LENGTH,
  WHISPERING_ASCENT,
  ascentBlend,
  ascentPointAt,
  ascentStones,
  ascentSurfaceY,
  ascentWalkY,
  onAscentLane,
  onAscentTreads,
  projectOntoAscent,
} from './mysteriousStairs'
import { isWalkable, terrainHeight, walkHeight } from './sunmereVale'

describe('Whispering Ascent', () => {
  it('projects centerline points with along rising from base to top', () => {
    const base = projectOntoAscent(...WHISPERING_ASCENT.path[0])!
    const top = projectOntoAscent(...WHISPERING_ASCENT.path[WHISPERING_ASCENT.path.length - 1])!
    expect(base.along).toBeCloseTo(0, 2)
    expect(top.along).toBeCloseTo(1, 2)
    expect(ASCENT_LENGTH).toBeGreaterThan(8)
  })

  it('quantizes walk height into rising steps with a flat mid-landing', () => {
    const baseY = ascentSurfaceY(0)
    const midY = ascentSurfaceY((WHISPERING_ASCENT.landingAlongStart + WHISPERING_ASCENT.landingAlongEnd) / 2)
    const topY = ascentSurfaceY(1)
    expect(midY).toBeGreaterThan(baseY)
    expect(topY).toBeGreaterThan(midY)
    expect(midY).toBeCloseTo(WHISPERING_ASCENT.landingY, 5)
    expect(topY).toBeCloseTo(WHISPERING_ASCENT.topY, 5)

    // Discrete steps: nearby samples on a flight share a tread until the next riser.
    const a = ascentSurfaceY(0.12)
    const b = ascentSurfaceY(0.125)
    expect(a).toBe(b)
  })

  it('raises walkHeight along the lane above raw terrain at the summit', () => {
    const [tx, tz] = ascentPointAt(0.92)
    expect(onAscentLane(tx, tz)).toBe(true)
    expect(walkHeight(tx, tz)).toBeGreaterThan(terrainHeight(tx, tz) - 0.05)
    expect(walkHeight(tx, tz)).toBeGreaterThan(walkHeight(...WHISPERING_ASCENT.path[0]))
  })

  it('monotonically climbs along the centerline', () => {
    let previous = -Infinity
    for (let i = 0; i <= 20; i += 1) {
      const along = i / 20
      const [x, z] = ascentPointAt(along)
      const y = walkHeight(x, z)
      expect(y).toBeGreaterThanOrEqual(previous - 1e-6)
      previous = y
    }
  })

  it('blends off the lane back to terrain', () => {
    const [cx, cz] = ascentPointAt(0.3)
    expect(ascentBlend(cx, cz)).toBeCloseTo(1, 5)
    const farX = cx + 8
    expect(ascentBlend(farX, cz)).toBe(0)
    expect(walkHeight(farX, cz)).toBeCloseTo(terrainHeight(farX, cz), 5)
  })

  it('keeps the stair lane walkable and marks treads vs landing', () => {
    for (const along of [0.05, 0.25, 0.47, 0.75, 0.95]) {
      const [x, z] = ascentPointAt(along)
      expect(isWalkable(x, z)).toBe(true)
      expect(ascentWalkY(x, z)).not.toBeNull()
    }
    const [treadX, treadZ] = ascentPointAt(0.2)
    const [landX, landZ] = ascentPointAt(0.47)
    expect(onAscentTreads(treadX, treadZ)).toBe(true)
    expect(onAscentTreads(landX, landZ)).toBe(false)
  })

  it('builds procedural treads and low curbs aligned to the walk surface', () => {
    const treads = ascentStones.filter((stone) => stone.kind === 'tread')
    const curbs = ascentStones.filter((stone) => stone.kind === 'curb')

    expect(treads.length).toBeGreaterThanOrEqual(12)
    expect(curbs.length).toBe(treads.length * 2)

    for (const tread of treads) {
      expect(tread.size[0]).toBeCloseTo(WHISPERING_ASCENT.halfWidth * 2, 5)
      expect(tread.size[1]).toBeGreaterThan(0.1)
      expect(tread.size[2]).toBeGreaterThan(0.4)
      const hit = projectOntoAscent(tread.position[0], tread.position[2])!
      const visibleTop = tread.position[1] + tread.size[1] / 2
      expect(visibleTop).toBeCloseTo(ascentSurfaceY(hit.along), 5)
    }

    for (const curb of curbs) {
      expect(curb.size[0]).toBeLessThan(0.3)
      expect(curb.size[1]).toBeLessThan(0.3)
    }
  })
})
