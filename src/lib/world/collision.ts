import {
  WORLD_BOUNDS,
  collisionCircles,
  onBridgeDeck,
  sampleRiver,
  scenery,
  sceneryColliderRadius,
  type SceneryPoint,
} from './data/sunmereVale'
import { SILVERRUN_SHALLOW_WATER01 } from './data/silverrunChannel'

export const HERO_RADIUS = 0.65

/** Tiny pad on the deep core so the wall isn't a knife-edge (not a full body radius). */
const DEEP_CORE_PAD = 0.06

export type CircleCollider = { x: number; z: number; radius: number }

/** Static world colliders: landmarks + solid scenery (trees / rocks). */
export const worldColliders: CircleCollider[] = [
  ...collisionCircles,
  ...scenery.flatMap((point: SceneryPoint) => {
    const radius = sceneryColliderRadius(point)
    return radius ? [{ x: point.x, z: point.z, radius }] : []
  }),
]

function deepCoreHalfWidth(waterHalfWidth: number) {
  return waterHalfWidth * SILVERRUN_SHALLOW_WATER01
}

/**
 * Wading query for splash / ford bob. Requires feet in water — dry shore near
 * the lip must not flicker the wading animation.
 */
export function overlapsRiver(x: number, z: number, radius: number) {
  if (onBridgeDeck(x, z, -radius * 0.35)) return false
  const river = sampleRiver(x, z)
  // Only the wet surface counts. A hair of foot radius is ok once already in water.
  if (!river.inWater) return false
  if (river.fordBlend > 0.35) return true
  return !river.isDeep
}

/**
 * Deep core is impassable. Test the foot point (plus a tiny pad), not the full
 * hero disc — otherwise the pad eats the whole shallow shelf and shove-corrects
 * every frame (shorefront twitch).
 */
export function riverBlocksMovement(x: number, z: number, radius = 0) {
  if (onBridgeDeck(x, z, -Math.min(radius, DEEP_CORE_PAD))) return false
  const river = sampleRiver(x, z)
  if (river.fordBlend > 0.35) return false
  return river.distance < deepCoreHalfWidth(river.waterHalfWidth) + DEEP_CORE_PAD
}

/** Nudge feet onto the shallow shelf just outside the deep core. */
export function pushOutOfRiver(x: number, z: number, radius: number) {
  if (!riverBlocksMovement(x, z, radius)) return { x, z }
  const river = sampleRiver(x, z)
  const side = river.signedDistance >= 0 ? 1 : -1
  const target = deepCoreHalfWidth(river.waterHalfWidth) + DEEP_CORE_PAD + 0.02
  return {
    x,
    z: river.centerZ + target * side,
  }
}

export function inWorldBounds(x: number, z: number, radius: number) {
  return (
    x >= WORLD_BOUNDS.minX + radius &&
    x <= WORLD_BOUNDS.maxX - radius &&
    z >= WORLD_BOUNDS.minZ + radius &&
    z <= WORLD_BOUNDS.maxZ - radius
  )
}

export function clampToWorldBounds(x: number, z: number, radius: number) {
  return {
    x: Math.min(WORLD_BOUNDS.maxX - radius, Math.max(WORLD_BOUNDS.minX + radius, x)),
    z: Math.min(WORLD_BOUNDS.maxZ - radius, Math.max(WORLD_BOUNDS.minZ + radius, z)),
  }
}

/** Push a disc out of overlapping solid circles (iterated for clustered props). */
export function separateFromColliders(
  x: number,
  z: number,
  radius: number,
  colliders: CircleCollider[] = worldColliders,
) {
  let px = x
  let pz = z
  for (let pass = 0; pass < 5; pass += 1) {
    let pushed = false
    for (const circle of colliders) {
      const dx = px - circle.x
      const dz = pz - circle.z
      const minDist = radius + circle.radius
      const distSq = dx * dx + dz * dz
      if (distSq >= minDist * minDist) continue
      if (distSq < 1e-8) {
        px = circle.x + minDist
        pz = circle.z
      } else {
        const dist = Math.sqrt(distSq)
        const push = (minDist - dist) / dist
        px += dx * push
        pz += dz * push
      }
      pushed = true
    }
    if (!pushed) break
  }
  return { x: px, z: pz }
}

/**
 * Project an arbitrary XZ sample onto the nearest free point — used for followers
 * that lerp along a trail and would otherwise tunnel through houses.
 */
export function resolveFreePosition(x: number, z: number, radius = HERO_RADIUS) {
  let pos = separateFromColliders(x, z, radius)
  pos = pushOutOfRiver(pos.x, pos.z, radius)
  pos = separateFromColliders(pos.x, pos.z, radius)
  if (riverBlocksMovement(pos.x, pos.z, radius)) pos = pushOutOfRiver(pos.x, pos.z, radius)
  return clampToWorldBounds(pos.x, pos.z, radius)
}

export function isFree(x: number, z: number, radius = HERO_RADIUS) {
  if (!inWorldBounds(x, z, radius)) return false
  if (riverBlocksMovement(x, z, radius)) return false
  for (const circle of worldColliders) {
    const minDist = radius + circle.radius
    const dx = x - circle.x
    const dz = z - circle.z
    if (dx * dx + dz * dz < minDist * minDist) return false
  }
  return true
}

/**
 * Move a disc with axis-separated sliding. River deep-core is a soft clamp
 * (slide along the shelf), not a reject/shove fight that twitches the shore.
 */
export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius = HERO_RADIUS,
) {
  const tryAxis = (fromX: number, fromZ: number, stepX: number, stepZ: number) => {
    const nextX = fromX + stepX
    const nextZ = fromZ + stepZ
    const separated = separateFromColliders(nextX, nextZ, radius)
    if (!inWorldBounds(separated.x, separated.z, radius)) return { x: fromX, z: fromZ }

    // Collider tunneling guard — measure before river clamp so shelf slides aren't rejected.
    if (Math.hypot(separated.x - nextX, separated.z - nextZ) > radius * 1.25) {
      return { x: fromX, z: fromZ }
    }

    const cleared = pushOutOfRiver(separated.x, separated.z, radius)
    if (riverBlocksMovement(cleared.x, cleared.z, radius)) return { x: fromX, z: fromZ }
    return cleared
  }

  let pos = tryAxis(x, z, dx, 0)
  pos = tryAxis(pos.x, pos.z, 0, dz)
  return pos
}
