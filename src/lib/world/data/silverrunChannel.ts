/**
 * Authoritative Silverrun profile.
 *
 * Terrain, rendering, crossings, vegetation and collision all sample this file.
 * The old river used one sine and several unrelated width constants; this profile
 * deliberately carries the whole corridor contract in one smooth data set.
 */

export const WATER_SURFACE_Y = -0.3
export const RIVER_MIN_X = -48
export const RIVER_MAX_X = 48
export const SILVERRUN_FORD_X = -20
/** Along-channel half-length of the full-crossing ford (world units). */
export const SILVERRUN_FORD_HALF_LENGTH = 6.2
/**
 * Outer channel shelf that stays wadable. `water01` above this (toward the
 * banks) is walkable; the deep core below it blocks until the ford.
 */
export const SILVERRUN_SHALLOW_WATER01 = 0.52

type ChannelKnot = {
  x: number
  z: number
  waterHalfWidth: number
  bankHalfWidth: number
  depth: number
}

const CHANNEL_KNOTS: readonly ChannelKnot[] = [
  { x: -48, z: 0.8, waterHalfWidth: 2.75, bankHalfWidth: 4.35, depth: 1.1 },
  { x: -38, z: -0.3, waterHalfWidth: 2.95, bankHalfWidth: 4.65, depth: 1.25 },
  { x: -29, z: -2.55, waterHalfWidth: 3.15, bankHalfWidth: 4.9, depth: 1.35 },
  { x: -20, z: -2.0, waterHalfWidth: 2.6, bankHalfWidth: 4.2, depth: 0.42 },
  { x: -10, z: -0.25, waterHalfWidth: 2.9, bankHalfWidth: 4.6, depth: 1.05 },
  { x: 0, z: -0.85, waterHalfWidth: 3.05, bankHalfWidth: 4.75, depth: 1.3 },
  { x: 6, z: -2.0, waterHalfWidth: 3.2, bankHalfWidth: 4.95, depth: 1.45 },
  { x: 17, z: -4.1, waterHalfWidth: 3.35, bankHalfWidth: 5.15, depth: 1.55 },
  { x: 29, z: -3.15, waterHalfWidth: 3.05, bankHalfWidth: 4.7, depth: 1.32 },
  { x: 39, z: -0.75, waterHalfWidth: 2.85, bankHalfWidth: 4.45, depth: 1.18 },
  { x: 48, z: 0.3, waterHalfWidth: 2.75, bankHalfWidth: 4.3, depth: 1.08 },
] as const

export type RiverAxisSample = {
  x: number
  centerZ: number
  tangentX: number
  tangentZ: number
  normalX: number
  normalZ: number
  waterHalfWidth: number
  bankHalfWidth: number
  depth: number
  flowDistance: number
  fordBlend: number
}

export type RiverSample = RiverAxisSample & {
  z: number
  signedDistance: number
  distance: number
  water01: number
  bank01: number
  bedY: number
  inWater: boolean
  inBank: boolean
  isFord: boolean
  isDeep: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Centripetal-looking Catmull-Rom interpolation for the authored X knots. */
function catmullRom(a: number, b: number, c: number, d: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (
    2 * b +
    (-a + c) * t +
    (2 * a - 5 * b + 4 * c - d) * t2 +
    (-a + 3 * b - 3 * c + d) * t3
  )
}

function knotSegment(x: number) {
  const clampedX = clamp(x, RIVER_MIN_X, RIVER_MAX_X)
  let i = 0
  while (i < CHANNEL_KNOTS.length - 2 && clampedX > CHANNEL_KNOTS[i + 1].x) i += 1
  const b = CHANNEL_KNOTS[i]
  const c = CHANNEL_KNOTS[Math.min(CHANNEL_KNOTS.length - 1, i + 1)]
  const a = CHANNEL_KNOTS[Math.max(0, i - 1)]
  const d = CHANNEL_KNOTS[Math.min(CHANNEL_KNOTS.length - 1, i + 2)]
  return { a, b, c, d, t: clamp((clampedX - b.x) / Math.max(1e-6, c.x - b.x), 0, 1) }
}

function sampleField(x: number, field: keyof Omit<ChannelKnot, 'x'>) {
  const { a, b, c, d, t } = knotSegment(x)
  return catmullRom(a[field], b[field], c[field], d[field], t)
}

function centerAt(x: number) {
  return sampleField(x, 'z')
}

const FLOW_LUT_STEP = 1
const FLOW_DISTANCE_LUT: number[] = [0]
for (let x = RIVER_MIN_X + FLOW_LUT_STEP; x <= RIVER_MAX_X; x += FLOW_LUT_STEP) {
  const previousX = x - FLOW_LUT_STEP
  const previous = FLOW_DISTANCE_LUT[FLOW_DISTANCE_LUT.length - 1]
  FLOW_DISTANCE_LUT.push(previous + Math.hypot(FLOW_LUT_STEP, centerAt(x) - centerAt(previousX)))
}

/** Distance from the west end, cached for cheap movement and shader sampling. */
function flowDistanceAt(x: number) {
  const cursor = (clamp(x, RIVER_MIN_X, RIVER_MAX_X) - RIVER_MIN_X) / FLOW_LUT_STEP
  const lower = Math.floor(cursor)
  const upper = Math.min(FLOW_DISTANCE_LUT.length - 1, lower + 1)
  const t = cursor - lower
  return FLOW_DISTANCE_LUT[lower] + (FLOW_DISTANCE_LUT[upper] - FLOW_DISTANCE_LUT[lower]) * t
}

export function sampleRiverAxis(x: number): RiverAxisSample {
  const clampedX = clamp(x, RIVER_MIN_X, RIVER_MAX_X)
  const centerZ = centerAt(clampedX)
  const epsilon = 0.08
  const dz = centerAt(clampedX + epsilon) - centerAt(clampedX - epsilon)
  const length = Math.hypot(epsilon * 2, dz)
  const tangentX = (epsilon * 2) / length
  const tangentZ = dz / length
  const fordBlend =
    1 - smoothstep(SILVERRUN_FORD_HALF_LENGTH * 0.55, SILVERRUN_FORD_HALF_LENGTH, Math.abs(clampedX - SILVERRUN_FORD_X))
  return {
    x: clampedX,
    centerZ,
    tangentX,
    tangentZ,
    normalX: -tangentZ,
    normalZ: tangentX,
    waterHalfWidth: Math.max(2.35, sampleField(clampedX, 'waterHalfWidth')),
    bankHalfWidth: Math.max(3.8, sampleField(clampedX, 'bankHalfWidth')),
    depth: Math.max(0.36, sampleField(clampedX, 'depth')),
    flowDistance: flowDistanceAt(clampedX),
    fordBlend,
  }
}

export function sampleRiver(x: number, z: number): RiverSample {
  const axis = sampleRiverAxis(x)
  // Channel is single-valued in X: lateral distance is world-Z from the centerline.
  // (Normal-space width is still used for mesh placement; Z distance drives gameplay.)
  const signedDistance = z - axis.centerZ
  const distance = Math.abs(signedDistance)
  const water01 = clamp(distance / axis.waterHalfWidth, 0, 1)
  const bank01 = clamp(distance / axis.bankHalfWidth, 0, 1)
  const crossSection = Math.pow(Math.max(0, 1 - water01 * water01), 0.72)
  const bedY = WATER_SURFACE_Y - axis.depth * crossSection
  const inWater = distance < axis.waterHalfWidth
  // Full crossing at the authored ford; elsewhere only the outer shelf is wadable.
  const isFord = inWater && axis.fordBlend > 0.35
  const isShallowShelf = inWater && water01 >= SILVERRUN_SHALLOW_WATER01
  const isWadable = isFord || isShallowShelf
  return {
    ...axis,
    z,
    signedDistance,
    distance,
    water01,
    bank01,
    bedY,
    inWater,
    inBank: distance < axis.bankHalfWidth,
    isFord,
    isDeep: inWater && !isWadable,
  }
}

export function riverCenter(x: number) {
  return sampleRiverAxis(x).centerZ
}

/** Compatibility maximum; new code should sample `waterHalfWidth` at its X. */
export const RIVER_HALF_WIDTH = Math.max(...CHANNEL_KNOTS.map((knot) => knot.waterHalfWidth))
