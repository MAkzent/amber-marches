import { type Intersection, type Object3D, Raycaster, Sphere, Vector3 } from 'three'

export type CharacterSightTarget = {
  x: number
  y: number
  z: number
}

export const TREE_FADE_MIN_OPACITY = 0.34
export const TREE_FADE_NEAR_DISTANCE = 1.6
export const TREE_FADE_FAR_DISTANCE = 7.2
export const PARTY_TORSO_HEIGHT = 1.75

const target = new Vector3()
const cameraToTarget = new Vector3()
const cameraToTree = new Vector3()
const closestPoint = new Vector3()
const rayDirection = new Vector3()
const raycaster = new Raycaster()
const intersections: Intersection[] = []

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Strong near fade that smoothly disappears before a distant canopy can ghost. */
export function treeOpacityForDistance(distance: number) {
  const priority = smoothstep(TREE_FADE_NEAR_DISTANCE, TREE_FADE_FAR_DISTANCE, distance)
  return TREE_FADE_MIN_OPACITY + (1 - TREE_FADE_MIN_OPACITY) * priority
}

/**
 * Returns the target opacity for a tree's wind-transformed bounds.
 *
 * A tree only qualifies when its center is between the camera and the
 * controlled character's torso and that sight segment crosses the tree bounds.
 */
export function treeOcclusionOpacity(
  cameraPosition: Readonly<Vector3>,
  treeBounds: Readonly<Sphere>,
  character: Readonly<CharacterSightTarget>,
) {
  const effectiveRadius = treeBounds.radius * 0.9
  const radiusSquared = effectiveRadius * effectiveRadius

  target.set(character.x, character.y + PARTY_TORSO_HEIGHT, character.z)
  cameraToTarget.subVectors(target, cameraPosition)
  const segmentLengthSquared = cameraToTarget.lengthSq()
  if (segmentLengthSquared < 0.0001) return 1

  cameraToTree.subVectors(treeBounds.center, cameraPosition)
  const alongSegment = cameraToTree.dot(cameraToTarget) / segmentLengthSquared

  // A rear tree must never fade merely because its broad canopy reaches forward.
  if (alongSegment <= 0.01 || alongSegment >= 0.99) return 1

  closestPoint.copy(cameraPosition).addScaledVector(cameraToTarget, alongSegment)
  if (closestPoint.distanceToSquared(treeBounds.center) > radiusSquared) return 1

  const distance = Math.hypot(
    character.x - treeBounds.center.x,
    character.z - treeBounds.center.z,
  )
  return treeOpacityForDistance(distance)
}

/**
 * Confirms the coarse bounds result against the rendered tree geometry.
 * The ray ends at the controlled character's torso, so companions and geometry
 * behind the character cannot trigger a fade.
 */
export function treeActuallyOccludesCharacter(
  tree: Object3D,
  cameraPosition: Readonly<Vector3>,
  character: Readonly<CharacterSightTarget>,
) {
  target.set(character.x, character.y + PARTY_TORSO_HEIGHT, character.z)
  rayDirection.subVectors(target, cameraPosition)
  const distance = rayDirection.length()
  if (distance < 0.1) return false

  raycaster.set(cameraPosition, rayDirection.multiplyScalar(1 / distance))
  raycaster.near = 0.01
  raycaster.far = Math.max(0.01, distance - 0.05)
  intersections.length = 0
  raycaster.intersectObject(tree, true, intersections)
  return intersections.length > 0
}
