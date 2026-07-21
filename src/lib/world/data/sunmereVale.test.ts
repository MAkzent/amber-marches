import { describe, expect, it } from 'vitest'
import {
  ROAD_SCENERY_CLEARANCE,
  BRIDGE_APPROACH_OUTWARD,
  LANTERN_ROAD_SHOULDER,
  LANTERN_SPACING,
  LANTERN_WATER_CLEARANCE,
  MISTCLIFF_MOUNTAIN,
  SILVERRUN_BRIDGE,
  SILVERRUN_SPAN,
  WATER_SURFACE_Y,
  WHISPERING_ASCENT,
  ascentPointAt,
  bridgeApproachLanterns,
  bridgeDeckBlend,
  buildBridgeApproachLanterns,
  buildPilgrimLanterns,
  distanceToNearestRoad,
  inRiverChannel,
  isDryLanternGround,
  isWalkable,
  landmarks,
  onMistcliffSummit,
  onBridgeDeck,
  pilgrimLanterns,
  roadPaths,
  sampleRiver,
  sampleRiverAxis,
  sampleRoadCenterline,
  scenery,
  sceneryColliderRadius,
  terrainHeight,
  walkHeight,
} from './sunmereVale'
import { spanAbutments, spanDeckHeight } from '../build/crossings'

describe('Sunmere Vale scene data', () => {
  it('keeps deterministic scenery within the authored world', () => {
    const trees = scenery.filter((p) => p.kind === 'oak' || p.kind === 'pine')
    expect(trees.length).toBeGreaterThan(40)
    expect(trees.length).toBeLessThan(140)
    expect(scenery[0]).toMatchObject({
      kind: expect.stringMatching(/oak|pine|rock|flower/),
    })
  })

  it('keeps solid scenery off the road lanes', () => {
    for (const point of scenery) {
      const radius = sceneryColliderRadius(point)
      if (radius == null) continue
      expect(distanceToNearestRoad(point.x, point.z)).toBeGreaterThanOrEqual(
        ROAD_SCENERY_CLEARANCE - 1e-6,
      )
    }
  })

  it('keeps the shallow ford and bridge open while deep water is not walkable', () => {
    expect(inRiverChannel(-20, -2)).toBe(true)
    expect(isWalkable(-20, -2)).toBe(true)
    expect(isWalkable(SILVERRUN_SPAN.x, SILVERRUN_SPAN.z)).toBe(true)
    expect(isWalkable(-8, sampleRiverAxis(-8).centerZ)).toBe(false)
  })

  it('keeps the oriented bridge deck aligned for walkHeight', () => {
    expect(onBridgeDeck(SILVERRUN_SPAN.x, SILVERRUN_SPAN.z)).toBe(true)
    expect(isWalkable(SILVERRUN_SPAN.x, SILVERRUN_SPAN.z)).toBe(true)
    // Step off across-axis into open water (not along the deck).
    const acrossX = -SILVERRUN_SPAN.axisZ
    const acrossZ = SILVERRUN_SPAN.axisX
    const offX = SILVERRUN_SPAN.x + acrossX * (SILVERRUN_SPAN.halfWidth + 0.35)
    const offZ = SILVERRUN_SPAN.z + acrossZ * (SILVERRUN_SPAN.halfWidth + 0.35)
    expect(onBridgeDeck(offX, offZ)).toBe(false)
    expect(inRiverChannel(offX, offZ)).toBe(true)
    expect(isWalkable(offX, offZ)).toBe(false)
  })

  it('snaps pilgrim + shrine roads through Silverrun abutments', () => {
    const [a, b] = spanAbutments(SILVERRUN_SPAN)
    const main = roadPaths[0]
    const shrine = roadPaths[1]
    const nearAbutment = (path: Array<[number, number]>) =>
      path.some(
        (p) =>
          Math.hypot(p[0] - a[0], p[1] - a[1]) < 0.15 ||
          Math.hypot(p[0] - b[0], p[1] - b[1]) < 0.15,
      )
    expect(nearAbutment(main)).toBe(true)
    expect(nearAbutment(shrine)).toBe(true)
    // Shrine branch starts on an abutment (Y-junction), not alone mid-span.
    expect(
      Math.hypot(shrine[0][0] - a[0], shrine[0][1] - a[1]) < 0.15 ||
        Math.hypot(shrine[0][0] - b[0], shrine[0][1] - b[1]) < 0.15,
    ).toBe(true)
  })

  it('raises the watchtower landmark above the river basin', () => {
    expect(terrainHeight(22, -22)).toBeGreaterThan(terrainHeight(SILVERRUN_SPAN.x, SILVERRUN_SPAN.z))
  })

  it('forms a walkable mountain summit around the far castle', () => {
    const summitSamples: Array<[number, number]> = [
      [MISTCLIFF_MOUNTAIN.x, MISTCLIFF_MOUNTAIN.z],
      [WHISPERING_ASCENT.topX, WHISPERING_ASCENT.topZ],
      [-17.2, -28.1],
      [-19.2, -26.4],
    ]
    const heights = summitSamples.map(([x, z]) => terrainHeight(x, z))

    for (const [x, z] of summitSamples) {
      expect(onMistcliffSummit(x, z)).toBe(true)
      expect(isWalkable(x, z)).toBe(true)
    }
    expect(Math.min(...heights)).toBeGreaterThan(3.8)
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1)
    expect(terrainHeight(WHISPERING_ASCENT.topX, WHISPERING_ASCENT.topZ)).toBeCloseTo(
      WHISPERING_ASCENT.topY,
      1,
    )

    const castle = landmarks.find((landmark) => landmark.id === 'far-castle')!
    expect(Math.hypot(castle.xz[0] - WHISPERING_ASCENT.topX, castle.xz[1] - WHISPERING_ASCENT.topZ)).toBeGreaterThan(3)
  })

  it('connects the stair walk surface to the mountain terrain', () => {
    const [topX, topZ] = ascentPointAt(1)
    expect(walkHeight(topX, topZ)).toBeCloseTo(terrainHeight(topX, topZ), 1)
    expect(walkHeight(topX, topZ)).toBeGreaterThan(walkHeight(...ascentPointAt(0.5)))
  })

  it('lifts the walk surface onto the Silverrun bridge deck above water', () => {
    expect(walkHeight(SILVERRUN_SPAN.x, SILVERRUN_SPAN.z)).toBeGreaterThan(
      terrainHeight(SILVERRUN_SPAN.x, SILVERRUN_SPAN.z) + 0.5,
    )
    expect(walkHeight(SILVERRUN_SPAN.x, SILVERRUN_SPAN.z)).toBeCloseTo(
      spanDeckHeight(SILVERRUN_SPAN, SILVERRUN_SPAN.x, SILVERRUN_SPAN.z),
      5,
    )
    expect(SILVERRUN_BRIDGE.deckY).toBeGreaterThan(WATER_SURFACE_Y + 0.5)
    expect(SILVERRUN_BRIDGE.deckY).toBeLessThan(1.1)
    expect(walkHeight(SILVERRUN_SPAN.x, SILVERRUN_SPAN.z)).toBeGreaterThan(walkHeight(-20, -2))
  })

  it('blends walkHeight to terrain at the span edge', () => {
    expect(bridgeDeckBlend(SILVERRUN_BRIDGE.x, SILVERRUN_BRIDGE.z)).toBeCloseTo(1, 5)
    const [edge] = spanAbutments(SILVERRUN_SPAN)
    expect(bridgeDeckBlend(edge[0], edge[1])).toBeCloseTo(0, 5)
    expect(walkHeight(edge[0], edge[1])).toBeCloseTo(terrainHeight(edge[0], edge[1]), 5)
  })

  it('fords along the carved bowl instead of jumping onto a water plane', () => {
    expect(walkHeight(-20, -2)).toBeCloseTo(terrainHeight(-20, -2), 5)
    expect(walkHeight(-20, -2)).toBeLessThan(WATER_SURFACE_Y)
    // Gradual approach: bank sample is higher than midstream.
    expect(walkHeight(-20, 2)).toBeGreaterThan(walkHeight(-20, -2))
  })

  it('varies channel width and depth while keeping the authored ford shallow', () => {
    const ford = sampleRiverAxis(-20)
    const bridge = sampleRiverAxis(SILVERRUN_SPAN.x)
    const east = sampleRiverAxis(17)
    expect(ford.depth).toBeLessThan(bridge.depth * 0.5)
    expect(east.waterHalfWidth).not.toBeCloseTo(ford.waterHalfWidth, 2)
    expect(ford.fordBlend).toBeGreaterThan(0.9)
    expect(bridge.fordBlend).toBeLessThan(0.1)
  })

  it('does not elevate walkHeight inside house footprints (houses are blockers)', () => {
    const x = -13
    const z = 10
    expect(walkHeight(x, z)).toBeCloseTo(terrainHeight(x, z), 5)
  })

  it('keeps road centerline samples free of tree/rock footprints', () => {
    for (const path of roadPaths) {
      for (const [x, z] of sampleRoadCenterline(path, 0.5)) {
        for (const point of scenery) {
          const radius = sceneryColliderRadius(point)
          if (radius == null) continue
          expect(Math.hypot(point.x - x, point.z - z)).toBeGreaterThan(radius)
        }
      }
    }
  })

  it('keeps pilgrim lanterns on dry road shoulders, never in the channel', () => {
    expect(pilgrimLanterns.length).toBeGreaterThan(6)
    expect(pilgrimLanterns.length).toBeLessThan(20)

    for (const [x, z] of pilgrimLanterns) {
      expect(isDryLanternGround(x, z)).toBe(true)
      expect(inRiverChannel(x, z)).toBe(false)
      expect(onBridgeDeck(x, z, 0.5)).toBe(false)
      const river = sampleRiver(x, z)
      expect(river.distance).toBeGreaterThanOrEqual(river.waterHalfWidth + LANTERN_WATER_CLEARANCE)
      expect(distanceToNearestRoad(x, z)).toBeLessThanOrEqual(LANTERN_ROAD_SHOULDER + 0.35)
    }

    for (let i = 0; i < pilgrimLanterns.length; i += 1) {
      for (let j = i + 1; j < pilgrimLanterns.length; j += 1) {
        const [ax, az] = pilgrimLanterns[i]
        const [bx, bz] = pilgrimLanterns[j]
        expect(Math.hypot(ax - bx, az - bz)).toBeGreaterThanOrEqual(LANTERN_SPACING - 1e-6)
      }
    }
  })

  it('rejects the old mid-channel lantern waypoints', () => {
    expect(isDryLanternGround(-1, 2)).toBe(false)
    expect(isDryLanternGround(3, -1)).toBe(false)
    expect(buildPilgrimLanterns().some(([x, z]) => Math.hypot(x + 1, z - 2) < 0.5)).toBe(false)
    expect(buildPilgrimLanterns().some(([x, z]) => Math.hypot(x - 3, z + 1) < 0.5)).toBe(false)
  })

  it('places four shrine lamps off the deck at both Silverrun approaches', () => {
    expect(bridgeApproachLanterns).toHaveLength(4)
    expect(buildBridgeApproachLanterns()).toEqual(bridgeApproachLanterns)

    const abutments = spanAbutments(SILVERRUN_SPAN)
    for (const [x, z] of bridgeApproachLanterns) {
      expect(isDryLanternGround(x, z)).toBe(true)
      expect(inRiverChannel(x, z)).toBe(false)
      expect(onBridgeDeck(x, z, 0.5)).toBe(false)
      const nearAbutment = abutments.some(
        ([ax, az]) => Math.hypot(ax - x, az - z) < BRIDGE_APPROACH_OUTWARD + LANTERN_ROAD_SHOULDER + 0.35,
      )
      expect(nearAbutment).toBe(true)
    }
  })
})

