import {
  RIVER_HALF_WIDTH,
  WORLD_BOUNDS,
  collisionCircles,
  onBridgeDeck,
  riverCenter,
  scenery,
  sceneryColliderRadius,
  type SceneryPoint,
} from './data/sunmereVale'

export const HERO_RADIUS = 0.65

export type CircleCollider = { x: number; z: number; radius: number }

/** Static world colliders: landmarks + solid scenery (trees / rocks). */
export const worldColliders: CircleCollider[] = [
  ...collisionCircles,
  ...scenery.flatMap((point: SceneryPoint) => {
    const radius = sceneryColliderRadius(point)
    return radius ? [{ x: point.x, z: point.z, radius }] : []
  }),
]

/**
 * River channel as an infinite band along riverCenter(x), with a bridge-deck exception.
 * The bridge gate uses the same ellipse as walkHeight so feet and collision agree.
 */
export function overlapsRiver(x: number, z: number, radius: number) {
  if (onBridgeDeck(x, z, -radius * 0.35)) return false
  return Math.abs(z - riverCenter(x)) < RIVER_HALF_WIDTH + radius
}

/** Nudge a point out of the river band onto the nearer bank (bridge excluded). */
export function pushOutOfRiver(x: number, z: number, radius: number) {
  if (!overlapsRiver(x, z, radius)) return { x, z }
  const center = riverCenter(x)
  const sign = z >= center ? 1 : -1
  return { x, z: center + sign * (RIVER_HALF_WIDTH + radius + 0.05) }
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
 * that lerp along a trail and would otherwise tunnel through houses / the river.
 */
export function resolveFreePosition(x: number, z: number, radius = HERO_RADIUS) {
  let pos = separateFromColliders(x, z, radius)
  pos = pushOutOfRiver(pos.x, pos.z, radius)
  pos = separateFromColliders(pos.x, pos.z, radius)
  if (overlapsRiver(pos.x, pos.z, radius)) pos = pushOutOfRiver(pos.x, pos.z, radius)
  return clampToWorldBounds(pos.x, pos.z, radius)
}

export function isFree(x: number, z: number, radius = HERO_RADIUS) {
  if (!inWorldBounds(x, z, radius)) return false
  if (overlapsRiver(x, z, radius)) return false
  for (const circle of worldColliders) {
    const minDist = radius + circle.radius
    const dx = x - circle.x
    const dz = z - circle.z
    if (dx * dx + dz * dz < minDist * minDist) return false
  }
  return true
}

/**
 * Move a disc with axis-separated sliding, then circle separation so
 * the party glides around trees / buildings instead of sticking.
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
    if (overlapsRiver(separated.x, separated.z, radius)) return { x: fromX, z: fromZ }
    // Reject if separation shoved us too far (tunneling into a tight gap).
    if (Math.hypot(separated.x - nextX, separated.z - nextZ) > radius * 1.25) {
      return { x: fromX, z: fromZ }
    }
    return separated
  }

  let pos = tryAxis(x, z, dx, 0)
  pos = tryAxis(pos.x, pos.z, 0, dz)
  return pos
}
