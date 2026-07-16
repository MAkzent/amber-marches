/**
 * Shared ford disturbances so the water mesh and splash FX stay in sync.
 * Heroes push ripples; RiverSurface + RiverFoamFx sample them each frame.
 *
 * Each disturbance is stamped once at the footfall and stays fixed on the water.
 * Spacing is per-unit so one hero's wakes never suppress another's first step in.
 */

export const MAX_WATER_DISTURBANCES = 6
/** World-space gap between wake stamps for the same unit. */
export const MIN_WATER_RIPPLE_SPACING = 1.4

export type WaterDisturbance = {
  x: number
  z: number
  /** 0..~1.4 strength — fades as the ring expands. */
  strength: number
  /** Seconds since spawn. */
  age: number
  /** How far feet sit below the visual water plane (world units). */
  depth: number
  /** Party / actor id that stamped this wake. */
  unitId: string
}

/**
 * Matches WorldCamera explore OFFSET_X / OFFSET_Y / OFFSET_Z.
 * Water-plane FX at the actor XZ read up the billboard under this isometric perch;
 * pull toward the camera so ripples sit at the soles.
 */
const ISO_CAM_X = 0.66
const ISO_CAM_Z = 0.82
const ISO_CAM_Y = 0.98
const ISO_CAM_XZ = Math.hypot(ISO_CAM_X, ISO_CAM_Z)
const ISO_TOWARD_X = ISO_CAM_X / ISO_CAM_XZ
const ISO_TOWARD_Z = ISO_CAM_Z / ISO_CAM_XZ
const ISO_SLOPE = ISO_CAM_XZ / ISO_CAM_Y
/** Extra pull so rings sit at the soles even when feet are near the surface. */
const SOLE_BIAS = 0.55

const disturbances: WaterDisturbance[] = []
/** Last stamp XZ per unit — spacing is only checked against this, not other units. */
const lastStampByUnit = new Map<string, { x: number; z: number }>()

export function getWaterDisturbances() {
  return disturbances
}

/** Clear a unit's spacing memory (call when they leave the water). */
export function clearWaterDisturbanceUnit(unitId: string) {
  lastStampByUnit.delete(unitId)
}

/**
 * Map a foot plant (x,z) + ford depth onto the water plane so the FX lines up
 * with the visible soles under the isometric camera.
 */
export function waterFxAtFeet(x: number, z: number, depth = 0) {
  const pull = SOLE_BIAS + Math.max(0, depth) * ISO_SLOPE
  return {
    x: x + ISO_TOWARD_X * pull,
    z: z + ISO_TOWARD_Z * pull,
  }
}

export type PushWaterDisturbanceOptions = {
  /** Skip per-unit spacing — used for the first step into water. */
  force?: boolean
}

/**
 * Stamp a footfall / wake on the water. Position is fixed at spawn.
 * Spacing is per `unitId` so each hero's first entry is always recognized.
 * `depth` is WATER_SURFACE_Y - footY so deeper fords throw bigger wakes.
 */
export function pushWaterDisturbance(
  x: number,
  z: number,
  strength = 1,
  depth = 0,
  unitId = 'default',
  options?: PushWaterDisturbanceOptions,
) {
  const clamped = Math.max(0.15, Math.min(1.4, strength))
  const fordDepth = Math.max(0, depth)
  const feet = waterFxAtFeet(x, z, fordDepth)

  if (!options?.force) {
    const last = lastStampByUnit.get(unitId)
    if (last && Math.hypot(last.x - feet.x, last.z - feet.z) < MIN_WATER_RIPPLE_SPACING) {
      return false
    }
  }

  if (disturbances.length >= MAX_WATER_DISTURBANCES) {
    disturbances.shift()
  }
  disturbances.push({
    x: feet.x,
    z: feet.z,
    strength: clamped,
    age: 0,
    depth: fordDepth,
    unitId,
  })
  lastStampByUnit.set(unitId, { x: feet.x, z: feet.z })
  return true
}

export function tickWaterDisturbances(delta: number) {
  for (let index = disturbances.length - 1; index >= 0; index -= 1) {
    const d = disturbances[index]
    d.age += delta
    d.strength *= Math.exp(-delta * 1.65)
    if (d.age > 2.4 || d.strength < 0.04) disturbances.splice(index, 1)
  }
}
