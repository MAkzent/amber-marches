/**
 * Bridge / water / road crossing contracts.
 *
 * Authored props still live in sunmereVale, but every span answers:
 * - where abutments are (road snap targets)
 * - where the walk deck is (walkHeight / FX gates)
 * - where open water must stay visible (road mesh gaps)
 * - where the bridge throws a shadow on the water
 *
 * Future crossings register here so snap + ribbon logic stay shared.
 */

import { WATER_SURFACE_Y, riverCenter, sampleRiverAxis } from '../data/silverrunChannel'

export type BridgeSpan = {
  id: string
  /** Deck center in XZ — must sit on the water channel. */
  x: number
  z: number
  /** Unit axis along the deck (across the river). */
  axisX: number
  axisZ: number
  /** Half-length along axis (abutment ↔ abutment). */
  halfLength: number
  /** Half-width across axis (parapet ↔ parapet). */
  halfWidth: number
  /** Walk surface Y for the deck overlay. */
  deckY: number
  /** Height added at midspan to form the shallow stone crown. */
  crown: number
  /** Stone apron beyond each structural end. */
  approachLength: number
  /** Visual water plane under the span. */
  waterY: number
}

function normalize2(x: number, z: number): [number, number] {
  const len = Math.hypot(x, z)
  if (len < 1e-8) return [1, 0]
  return [x / len, z / len]
}

/** Perpendicular in XZ (rotate axis +90° around Y). */
export function spanPerp(span: BridgeSpan): [number, number] {
  return [-span.axisZ, span.axisX]
}

/**
 * The procedural bridge is authored along local +X.
 * Yaw maps local +X onto the span axis in XZ.
 */
export function spanYawFromAxis(axisX: number, axisZ: number) {
  // local (1,0,0) after Y-rot θ → (cos θ, -sin θ) in Three.js Y-up.
  return Math.atan2(-axisZ, axisX)
}

/**
 * Project (x,z) into span-local coordinates.
 * `along` = distance along deck axis, `across` = signed distance to centerline.
 */
export function projectOntoSpan(span: BridgeSpan, x: number, z: number) {
  const dx = x - span.x
  const dz = z - span.z
  const along = dx * span.axisX + dz * span.axisZ
  const across = dx * -span.axisZ + dz * span.axisX
  return { along, across }
}

/** Oriented rectangle membership for the walk deck. */
export function onSpanDeck(span: BridgeSpan, x: number, z: number, margin = 0) {
  const { along, across } = projectOntoSpan(span, x, z)
  return (
    Math.abs(along) <= span.halfLength + span.approachLength + margin &&
    Math.abs(across) <= span.halfWidth + margin
  )
}

/**
 * Narrow strip along the deck centerline — kept for queries / future paint.
 * Road meshes gap all open water; the dedicated stone deck is the crossing.
 */
export function onSpanCrossingStrip(
  span: BridgeSpan,
  x: number,
  z: number,
  halfStripWidth = 0.55,
  lengthMargin = 0.2,
) {
  const { along, across } = projectOntoSpan(span, x, z)
  return Math.abs(along) <= span.halfLength + lengthMargin && Math.abs(across) <= halfStripWidth
}

/** Soft 1→0 falloff from deck center to rectangle edge (walkHeight blend). */
export function spanDeckBlend(span: BridgeSpan, x: number, z: number) {
  const { along, across } = projectOntoSpan(span, x, z)
  const alongEdge = span.halfLength + span.approachLength
  const alongFade = 1 - smoothstep(span.halfLength, alongEdge, Math.abs(along))
  const acrossFade = 1 - smoothstep(span.halfWidth * 0.78, span.halfWidth, Math.abs(across))
  return Math.max(0, Math.min(alongFade, acrossFade))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function spanDeckHeightAlong(span: BridgeSpan, along: number) {
  const normalized = Math.min(1, Math.abs(along) / Math.max(1e-6, span.halfLength))
  const crown = Math.cos(normalized * Math.PI * 0.5) ** 2
  return span.deckY + crown * span.crown
}

/** Shared analytical/visual crowned deck height. */
export function spanDeckHeight(span: BridgeSpan, x: number, z: number) {
  return spanDeckHeightAlong(span, projectOntoSpan(span, x, z).along)
}

/**
 * Bank abutments where roads should meet the span.
 * Index 0 = −axis end, index 1 = +axis end.
 */
export function spanAbutments(span: BridgeSpan): [[number, number], [number, number]] {
  const reach = span.halfLength + span.approachLength
  return [
    [span.x - span.axisX * reach, span.z - span.axisZ * reach],
    [span.x + span.axisX * reach, span.z + span.axisZ * reach],
  ]
}

/**
 * Push halfLength out until both ends sit on the river bank (outside the channel).
 * Keeps short art bridges from leaving abutments mid-stream.
 */
export function halfLengthToBanks(
  x: number,
  z: number,
  axisX: number,
  axisZ: number,
  minHalf = 2.0,
  bankFactor = 0.98,
): number {
  const target = sampleRiverAxis(x).bankHalfWidth * bankFactor
  let lo = minHalf
  let hi = Math.max(minHalf + 0.5, 8)
  for (let i = 0; i < 16; i += 1) {
    const mid = (lo + hi) / 2
    const d0 = Math.abs(z - axisZ * mid - riverCenter(x - axisX * mid))
    const d1 = Math.abs(z + axisZ * mid - riverCenter(x + axisX * mid))
    if (Math.min(d0, d1) < target) lo = mid
    else hi = mid
  }
  return hi
}

/** Soft shadow footprint on the water (slightly larger than the deck). */
export function spanWaterShadowFactor(
  span: BridgeSpan,
  x: number,
  z: number,
  pad = 0.55,
): number {
  const { along, across } = projectOntoSpan(span, x, z)
  const u = Math.abs(along) / (span.halfLength + pad)
  const v = Math.abs(across) / (span.halfWidth + pad * 0.65)
  const edge = Math.max(u, v)
  if (edge >= 1) return 0
  return (1 - edge) * (1 - edge)
}

/**
 * Snap a proposed bridge center onto the river and align the deck axis
 * across the channel (perpendicular to the local river tangent).
 *
 * Important: do NOT blend the axis toward the road chord — that pulled
 * Silverrun almost parallel to the flow so the bridge sat on the path.
 * Only the sign of the across-axis is chosen from the road hint.
 */
export function snapBridgeToRiver(
  id: string,
  x: number,
  axisHint?: [number, number],
  opts?: Partial<
    Pick<BridgeSpan, 'halfLength' | 'halfWidth' | 'deckY' | 'waterY' | 'crown' | 'approachLength'>
  > & {
    /** When true (default), extend halfLength to the banks. */
    reachBanks?: boolean
  },
): BridgeSpan {
  const channel = sampleRiverAxis(x)
  const z = channel.centerZ
  let axisX = channel.normalX
  let axisZ = channel.normalZ
  if (axisHint) {
    const [hx, hz] = normalize2(axisHint[0], axisHint[1])
    // Flip so the across-axis agrees with the road travel sense.
    if (hx * axisX + hz * axisZ < 0) {
      axisX = -axisX
      axisZ = -axisZ
    }
  }

  const reachBanks = opts?.reachBanks ?? true
  const halfLength =
    opts?.halfLength ??
    (reachBanks ? halfLengthToBanks(x, z, axisX, axisZ) : 2.55)

  return {
    id,
    x,
    z,
    axisX,
    axisZ,
    halfLength,
    halfWidth: opts?.halfWidth ?? 1.15,
    deckY: opts?.deckY ?? 0.58,
    crown: opts?.crown ?? 0.24,
    approachLength: opts?.approachLength ?? 0.8,
    waterY: opts?.waterY ?? WATER_SURFACE_Y,
  }
}

/**
 * Silverrun — axis crosses the channel; abutments sit on the banks.
 * Pilgrim road hint only picks the across-axis sign.
 */
export const SILVERRUN_SPAN: BridgeSpan = snapBridgeToRiver(
  'silverrun',
  6,
  [11 - -3, -9 - 5],
  {
    halfWidth: 1.42,
    deckY: 0.62,
    crown: 0.28,
    approachLength: 0.9,
    waterY: WATER_SURFACE_Y,
  },
)

/** All registered spans — road / water / shadow systems iterate this list. */
export const BRIDGE_SPANS: readonly BridgeSpan[] = [SILVERRUN_SPAN]

export function findSpanAt(x: number, z: number, margin = 0): BridgeSpan | null {
  for (const span of BRIDGE_SPANS) {
    if (onSpanDeck(span, x, z, margin)) return span
  }
  return null
}

export function anySpanCrossingStrip(x: number, z: number): boolean {
  return BRIDGE_SPANS.some((span) => onSpanCrossingStrip(span, x, z))
}

export function anySpanWaterShadow(x: number, z: number): number {
  let max = 0
  for (const span of BRIDGE_SPANS) {
    max = Math.max(max, spanWaterShadowFactor(span, x, z))
  }
  return max
}
