/**
 * Whispering Ascent — mysterious cliff stairs northeast of Shrinewood.
 *
 * Walk surface and visuals share the same procedural step descriptors. The
 * renderer turns each descriptor into simple Three.js stone geometry, keeping
 * the visible tread tops aligned with the analytical hero walk surface.
 *
 * Compass: −Z north, +Z south (see silverrunChannel.ts).
 */

export type StairProjection = {
  /** 0 at base → 1 at top along the centerline. */
  along: number
  /** Signed lateral distance from centerline (world units). */
  lateral: number
  /** Absolute distance to centerline. */
  distance: number
  /** Closest centerline point. */
  px: number
  pz: number
  /** Unit tangent along the climb (XZ). */
  tx: number
  tz: number
  /** Unit left normal (XZ). */
  nx: number
  nz: number
}

export type AscentSample = {
  projection: StairProjection | null
  blend: number
  walkY: number | null
}

/**
 * Centerline climbs north-west (−X/−Z) into the mist cliff.
 * Camera sits south-east of the party, so the flight reads bottom-near → top-far (up-left).
 */
export const WHISPERING_ASCENT = {
  id: 'whispering-ascent',
  path: [
    [-11.2, -17.0],
    [-12.4, -19.2],
    [-13.5, -21.2],
    [-14.4, -22.7],
    [-15.0, -23.5],
    [-15.6, -24.2],
    [-16.6, -25.6],
    [-17.5, -26.8],
    [-18.2, -27.9],
  ] as Array<[number, number]>,
  halfWidth: 1.7,
  /** Soft edge beyond halfWidth where walkHeight blends back to terrain. */
  blendMargin: 0.85,
  stepCount: 18,
  /** Flat grassy landing (fraction of path length). */
  landingAlongStart: 0.4,
  landingAlongEnd: 0.54,
  /** Authored walk Y — matched to the mistcliff mountain in terrainHeight. */
  baseY: -0.18,
  landingY: 2.3,
  topY: 4.72,
  /** Mid landing center for props / discovery approach. */
  landingX: -15.3,
  landingZ: -23.85,
  topX: -18.2,
  topZ: -27.9,
} as const

function pathLength(path: Array<[number, number]>) {
  let total = 0
  for (let i = 0; i < path.length - 1; i += 1) {
    const [ax, az] = path[i]
    const [bx, bz] = path[i + 1]
    total += Math.hypot(bx - ax, bz - az)
  }
  return total
}

export const ASCENT_LENGTH = pathLength(WHISPERING_ASCENT.path)

export type AscentStone = {
  id: string
  kind: 'tread' | 'curb'
  position: [number, number, number]
  rotation: [number, number, number]
  size: [number, number, number]
  /** Stable palette slot used for subtle per-block stone variation. */
  variant: number
}

const TREAD_OVERLAP = 0.12
const TREAD_BASE_DEPTH = 0.12
const CURB_WIDTH = 0.22
const CURB_HEIGHT = 0.22

function frameAt(along: number) {
  const [cx, cz] = ascentPointAt(along)
  const hit = projectOntoAscent(cx, cz)
  return {
    cx,
    cz,
    nx: hit?.nx ?? 1,
    nz: hit?.nz ?? 0,
    yaw: Math.atan2(hit?.tx ?? 0, hit?.tz ?? -1),
  }
}

/**
 * Build open stone stairs directly from the authored walk profile. Each tread
 * extends down into the previous level, so its leading face forms a visible
 * riser without requiring a second overlapping mesh.
 */
function buildFlight(
  idPrefix: string,
  along0: number,
  along1: number,
  steps: number,
): AscentStone[] {
  const stones: AscentStone[] = []
  let previousTop = ascentSurfaceY(along0)

  for (let step = 0; step < steps; step += 1) {
    const t0 = along0 + ((along1 - along0) * step) / steps
    const t1 = along0 + ((along1 - along0) * (step + 1)) / steps
    const along = (t0 + t1) / 2
    const frame = frameAt(along)
    const topY = ascentSurfaceY(along)
    const height = Math.max(TREAD_BASE_DEPTH, topY - previousTop + TREAD_BASE_DEPTH)
    const depth = Math.max(0.4, (t1 - t0) * ASCENT_LENGTH + TREAD_OVERLAP)
    const width = WHISPERING_ASCENT.halfWidth * 2

    stones.push({
      id: `${idPrefix}-tread-${step}`,
      kind: 'tread',
      position: [frame.cx, topY - height / 2, frame.cz],
      rotation: [0, frame.yaw, 0],
      size: [width, height, depth],
      variant: step % 4,
    })

    for (const side of [-1, 1] as const) {
      const lateral = side * (WHISPERING_ASCENT.halfWidth - CURB_WIDTH / 2)
      stones.push({
        id: `${idPrefix}-curb-${side < 0 ? 'left' : 'right'}-${step}`,
        kind: 'curb',
        position: [
          frame.cx + frame.nx * lateral,
          topY + CURB_HEIGHT / 2 - 0.015,
          frame.cz + frame.nz * lateral,
        ],
        rotation: [0, frame.yaw, 0],
        size: [CURB_WIDTH, CURB_HEIGHT, depth],
        variant: (step + (side < 0 ? 1 : 3)) % 4,
      })
    }

    previousTop = topY
  }

  return stones
}

const lowerSteps = Math.max(
  1,
  Math.round(WHISPERING_ASCENT.stepCount * WHISPERING_ASCENT.landingAlongStart),
)
const upperSteps = Math.max(
  1,
  Math.round(WHISPERING_ASCENT.stepCount * (1 - WHISPERING_ASCENT.landingAlongEnd)),
)

/** Procedural tread/riser blocks and low side curbs for both stair flights. */
export const ascentStones: readonly AscentStone[] = [
  ...buildFlight(
    'ascent-lower',
    0,
    WHISPERING_ASCENT.landingAlongStart,
    lowerSteps,
  ),
  ...buildFlight(
    'ascent-upper',
    WHISPERING_ASCENT.landingAlongEnd,
    1,
    upperSteps,
  ),
]

/** Closest point on the ascent centerline, with along-fraction and lateral offset. */
export function projectOntoAscent(x: number, z: number): StairProjection | null {
  const path = WHISPERING_ASCENT.path
  let bestDist = Infinity
  let best: StairProjection | null = null
  let traveled = 0

  for (let i = 0; i < path.length - 1; i += 1) {
    const [ax, az] = path[i]
    const [bx, bz] = path[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const lenSq = dx * dx + dz * dz
    const len = Math.sqrt(lenSq)
    if (len < 1e-8) continue
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lenSq))
    const px = ax + t * dx
    const pz = az + t * dz
    const dist = Math.hypot(x - px, z - pz)
    if (dist < bestDist) {
      bestDist = dist
      const tx = dx / len
      const tz = dz / len
      // Left normal in XZ (rotate tangent 90° CCW).
      const nx = -tz
      const nz = tx
      const lateral = (x - px) * nx + (z - pz) * nz
      best = {
        along: (traveled + t * len) / ASCENT_LENGTH,
        lateral,
        distance: dist,
        px,
        pz,
        tx,
        tz,
        nx,
        nz,
      }
    }
    traveled += len
  }
  return best
}

function blendForProjection(hit: StairProjection | null) {
  if (!hit) return 0
  const outer = WHISPERING_ASCENT.halfWidth + WHISPERING_ASCENT.blendMargin
  if (hit.distance >= outer) return 0
  if (hit.distance <= WHISPERING_ASCENT.halfWidth) return 1
  const edge = (hit.distance - WHISPERING_ASCENT.halfWidth) / WHISPERING_ASCENT.blendMargin
  return Math.max(0, 1 - edge)
}

/** Project once when callers need both stair blend and walk height. */
export function sampleAscent(x: number, z: number): AscentSample {
  const projection = projectOntoAscent(x, z)
  return {
    projection,
    blend: blendForProjection(projection),
    walkY: projection ? ascentSurfaceY(projection.along) : null,
  }
}

/** 1 on the lane center → 0 at outer blend edge. */
export function ascentBlend(x: number, z: number) {
  return sampleAscent(x, z).blend
}

export function onAscentLane(x: number, z: number, margin = 0) {
  const hit = projectOntoAscent(x, z)
  if (!hit) return false
  return hit.distance <= WHISPERING_ASCENT.halfWidth + margin
}

/** True on stepped treads (not the grassy mid-landing). */
export function onAscentTreads(x: number, z: number) {
  const hit = projectOntoAscent(x, z)
  if (!hit || hit.distance > WHISPERING_ASCENT.halfWidth + 0.15) return false
  const { landingAlongStart, landingAlongEnd } = WHISPERING_ASCENT
  return hit.along < landingAlongStart || hit.along > landingAlongEnd
}

/**
 * Discrete stair surface Y for a normalized along-fraction.
 * Mid-landing is flat; approaches and summit use step quantization.
 */
export function ascentSurfaceY(along: number) {
  const {
    baseY,
    landingY,
    topY,
    landingAlongStart: ls,
    landingAlongEnd: le,
  } = WHISPERING_ASCENT
  const a = Math.max(0, Math.min(1, along))

  if (a >= ls && a <= le) return landingY

  if (a < ls) {
    const local = a / ls
    const steps = lowerSteps
    const step = Math.min(steps, Math.ceil(local * steps - 1e-8))
    return baseY + (step / steps) * (landingY - baseY)
  }

  const local = (a - le) / (1 - le)
  const steps = upperSteps
  const step = Math.min(steps, Math.ceil(local * steps - 1e-8))
  return landingY + (step / steps) * (topY - landingY)
}

/** Walk-surface Y contributed by the ascent (before blending with terrain). */
export function ascentWalkY(x: number, z: number) {
  return sampleAscent(x, z).walkY
}

/** Sample centerline XZ at along ∈ [0,1]. */
export function ascentPointAt(along: number): [number, number] {
  const path = WHISPERING_ASCENT.path
  const target = Math.max(0, Math.min(1, along)) * ASCENT_LENGTH
  let traveled = 0
  for (let i = 0; i < path.length - 1; i += 1) {
    const [ax, az] = path[i]
    const [bx, bz] = path[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    if (traveled + len >= target || i === path.length - 2) {
      const t = len < 1e-8 ? 0 : (target - traveled) / len
      return [ax + (bx - ax) * t, az + (bz - az) * t]
    }
    traveled += len
  }
  const last = path[path.length - 1]
  return [last[0], last[1]]
}
