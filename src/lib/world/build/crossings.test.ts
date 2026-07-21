import { describe, expect, it } from 'vitest'
import {
  BRIDGE_SPANS,
  SILVERRUN_SPAN,
  applySpanRails,
  fromSpanLocal,
  onSpanCrossingStrip,
  onSpanDeck,
  projectOntoSpan,
  snapBridgeToRiver,
  spanAbutments,
  spanDeckBlend,
  spanDeckHeightAlong,
  spanWalkHalfWidth,
  spanWaterShadowFactor,
  spanYawFromAxis,
} from './crossings'
import {
  buildSnappedRoadNetwork,
  nearestAbutment,
  snapRoadAcrossSpan,
  snapRoadJoinSpan,
} from './snap'
import { riverCenter, sampleRiverAxis } from '../data/silverrunChannel'

describe('bridge crossings', () => {
  it('snaps the Silverrun span onto the river centerline', () => {
    expect(SILVERRUN_SPAN.z).toBeCloseTo(riverCenter(SILVERRUN_SPAN.x), 5)
    expect(SILVERRUN_SPAN.deckY).toBeGreaterThan(SILVERRUN_SPAN.waterY + 0.5)
    expect(BRIDGE_SPANS).toContain(SILVERRUN_SPAN)
  })

  it('keeps the span axis across the channel, not along the flow', () => {
    // River flows mostly +X; across-axis must be dominated by Z.
    expect(Math.abs(SILVERRUN_SPAN.axisZ)).toBeGreaterThan(Math.abs(SILVERRUN_SPAN.axisX))
    expect(Math.hypot(SILVERRUN_SPAN.axisX, SILVERRUN_SPAN.axisZ)).toBeCloseTo(1, 5)
  })

  it('places abutments on the river banks', () => {
    const [a, b] = spanAbutments(SILVERRUN_SPAN)
    expect(Math.abs(a[1] - riverCenter(a[0]))).toBeGreaterThanOrEqual(
      sampleRiverAxis(a[0]).bankHalfWidth * 0.9,
    )
    expect(Math.abs(b[1] - riverCenter(b[0]))).toBeGreaterThanOrEqual(
      sampleRiverAxis(b[0]).bankHalfWidth * 0.9,
    )
    expect(onSpanDeck(SILVERRUN_SPAN, a[0], a[1], 0.05)).toBe(true)
    expect(onSpanDeck(SILVERRUN_SPAN, b[0], b[1], 0.05)).toBe(true)
  })

  it('maps KayKit local +X onto the span axis (matches legacy π/2 for −Z)', () => {
    expect(spanYawFromAxis(0, -1)).toBeCloseTo(Math.PI / 2, 5)
    expect(spanYawFromAxis(SILVERRUN_SPAN.axisX, SILVERRUN_SPAN.axisZ)).toBeCloseTo(
      Math.atan2(-SILVERRUN_SPAN.axisZ, SILVERRUN_SPAN.axisX),
      5,
    )
  })

  it('uses a narrow crossing strip so water flanks the deck', () => {
    expect(onSpanCrossingStrip(SILVERRUN_SPAN, SILVERRUN_SPAN.x, SILVERRUN_SPAN.z)).toBe(true)
    const [px, pz] = [-SILVERRUN_SPAN.axisZ, SILVERRUN_SPAN.axisX]
    const flankX = SILVERRUN_SPAN.x + px * 1.6
    const flankZ = SILVERRUN_SPAN.z + pz * 1.6
    expect(onSpanCrossingStrip(SILVERRUN_SPAN, flankX, flankZ)).toBe(false)
    expect(onSpanDeck(SILVERRUN_SPAN, flankX, flankZ)).toBe(false)
  })

  it('throws a soft water shadow under the span', () => {
    expect(spanWaterShadowFactor(SILVERRUN_SPAN, SILVERRUN_SPAN.x, SILVERRUN_SPAN.z)).toBeGreaterThan(0.5)
    expect(spanWaterShadowFactor(SILVERRUN_SPAN, SILVERRUN_SPAN.x + 20, SILVERRUN_SPAN.z)).toBe(0)
  })

  it('snapBridgeToRiver aligns future spans to the channel', () => {
    const span = snapBridgeToRiver('test', 12, [0, 1], { reachBanks: false, halfLength: 2.5 })
    expect(span.z).toBeCloseTo(riverCenter(12), 5)
    expect(Math.abs(span.axisZ)).toBeGreaterThan(Math.abs(span.axisX))
  })

  it('blends deck walk height to zero at the span edge', () => {
    expect(spanDeckBlend(SILVERRUN_SPAN, SILVERRUN_SPAN.x, SILVERRUN_SPAN.z)).toBeCloseTo(1, 5)
    const [a] = spanAbutments(SILVERRUN_SPAN)
    expect(spanDeckBlend(SILVERRUN_SPAN, a[0], a[1])).toBeCloseTo(0, 5)
  })

  it('keeps full deck blend across the walk corridor (no parapet height cliff)', () => {
    const walkHalf = spanWalkHalfWidth(SILVERRUN_SPAN)
    const nearRail = fromSpanLocal(SILVERRUN_SPAN, 0, walkHalf - 0.05)
    expect(spanDeckBlend(SILVERRUN_SPAN, nearRail.x, nearRail.z)).toBeCloseTo(1, 5)
    const pastRail = fromSpanLocal(SILVERRUN_SPAN, 0, walkHalf + 0.05)
    expect(spanDeckBlend(SILVERRUN_SPAN, pastRail.x, pastRail.z)).toBe(0)
  })

  it('clamps on-deck sideways moves inside the walk corridor', () => {
    const walkHalf = spanWalkHalfWidth(SILVERRUN_SPAN)
    const from = fromSpanLocal(SILVERRUN_SPAN, 0, 0)
    const towardRail = fromSpanLocal(SILVERRUN_SPAN, 0, walkHalf + 0.8)
    const railed = applySpanRails(from.x, from.z, towardRail.x, towardRail.z, 0.65)
    const across = Math.abs(projectOntoSpan(SILVERRUN_SPAN, railed.x, railed.z).across)
    expect(across).toBeLessThanOrEqual(walkHalf)
    expect(across).toBeLessThan(Math.abs(projectOntoSpan(SILVERRUN_SPAN, towardRail.x, towardRail.z).across))
  })

  it('blocks mid-span side entry onto the deck', () => {
    const walkHalf = spanWalkHalfWidth(SILVERRUN_SPAN)
    const from = fromSpanLocal(SILVERRUN_SPAN, 0, walkHalf + 0.6)
    const into = fromSpanLocal(SILVERRUN_SPAN, 0, 0)
    const railed = applySpanRails(from.x, from.z, into.x, into.z, 0.65)
    const across = Math.abs(projectOntoSpan(SILVERRUN_SPAN, railed.x, railed.z).across)
    expect(across).toBeGreaterThan(walkHalf)
  })

  it('allows mounting the deck from the bank approaches', () => {
    const walkHalf = spanWalkHalfWidth(SILVERRUN_SPAN)
    const along = SILVERRUN_SPAN.halfLength + SILVERRUN_SPAN.approachLength * 0.5
    const from = fromSpanLocal(SILVERRUN_SPAN, along, walkHalf + 0.5)
    const into = fromSpanLocal(SILVERRUN_SPAN, along, 0)
    const railed = applySpanRails(from.x, from.z, into.x, into.z, 0.65)
    const across = Math.abs(projectOntoSpan(SILVERRUN_SPAN, railed.x, railed.z).across)
    expect(across).toBeLessThanOrEqual(walkHalf)
  })

  it('uses one crowned deck profile for geometry and walk height', () => {
    const center = spanDeckHeightAlong(SILVERRUN_SPAN, 0)
    const end = spanDeckHeightAlong(SILVERRUN_SPAN, SILVERRUN_SPAN.halfLength)
    expect(center).toBeCloseTo(SILVERRUN_SPAN.deckY + SILVERRUN_SPAN.crown, 5)
    expect(end).toBeCloseTo(SILVERRUN_SPAN.deckY, 5)
    expect(center).toBeGreaterThan(end)
  })
})

describe('road snap', () => {
  it('rewrites a through-road across abutments in travel order (no zigzag)', () => {
    const snapped = snapRoadAcrossSpan(
      [
        [-3, 5],
        [SILVERRUN_SPAN.x, SILVERRUN_SPAN.z],
        [11, -9],
      ],
      SILVERRUN_SPAN,
    )
    const [a, b] = spanAbutments(SILVERRUN_SPAN)
    const { near, far } = nearestAbutment(SILVERRUN_SPAN, [-3, 5])
    expect(snapped.some((p) => Math.hypot(p[0] - a[0], p[1] - a[1]) < 0.1)).toBe(true)
    expect(snapped.some((p) => Math.hypot(p[0] - b[0], p[1] - b[1]) < 0.1)).toBe(true)
    // Enter then exit — never backtrack through the deck center.
    const enterI = snapped.findIndex((p) => Math.hypot(p[0] - near[0], p[1] - near[1]) < 0.1)
    const exitI = snapped.findIndex((p) => Math.hypot(p[0] - far[0], p[1] - far[1]) < 0.1)
    expect(enterI).toBeGreaterThanOrEqual(0)
    expect(exitI).toBeGreaterThan(enterI)
    expect(
      snapped.some((p) => Math.hypot(p[0] - SILVERRUN_SPAN.x, p[1] - SILVERRUN_SPAN.z) < 0.1),
    ).toBe(false)
  })

  it('joins a branch at the nearer abutment, not mid-span alone', () => {
    const joined = snapRoadJoinSpan(
      [
        [SILVERRUN_SPAN.x, SILVERRUN_SPAN.z],
        [-3, -8],
      ],
      SILVERRUN_SPAN,
    )
    const { near } = nearestAbutment(SILVERRUN_SPAN, [-3, -8])
    expect(joined[0][0]).toBeCloseTo(near[0], 5)
    expect(joined[0][1]).toBeCloseTo(near[1], 5)
  })

  it('buildSnappedRoadNetwork applies cross + join contracts', () => {
    const roads = buildSnappedRoadNetwork([
      {
        waypoints: [
          [-3, 5],
          [SILVERRUN_SPAN.x, SILVERRUN_SPAN.z],
          [11, -9],
        ],
        crossSpanId: 'silverrun',
      },
      {
        waypoints: [
          [SILVERRUN_SPAN.x, SILVERRUN_SPAN.z],
          [-20, -16],
        ],
        joinSpanId: 'silverrun',
      },
    ])
    expect(roads).toHaveLength(2)
    expect(roads[0].length).toBeGreaterThanOrEqual(3)
    const [a, b] = spanAbutments(SILVERRUN_SPAN)
    const join = roads[1][0]
    expect(
      Math.hypot(join[0] - a[0], join[1] - a[1]) < 0.1 ||
        Math.hypot(join[0] - b[0], join[1] - b[1]) < 0.1,
    ).toBe(true)
  })
})
