/**
 * @deprecated Use `createPseudo3DSprite` from `./pseudo3dSprite`.
 * Kept as a thin re-export so older imports keep typechecking during the wrap.
 */
export {
  createPseudo3DSprite as createBillboardActor,
  type Pseudo3DSprite as BillboardActor,
} from './pseudo3dSprite'

import type { Camera } from 'three'
import type { Pseudo3DSprite } from './pseudo3dSprite'

/** @deprecated Prefer `sprite.faceCamera(camera)`. */
export function faceCameraYaw(mesh: { rotation: { y: number }; position: { x: number; z: number } }, camera: Camera) {
  mesh.rotation.y = Math.atan2(camera.position.x - mesh.position.x, camera.position.z - mesh.position.z)
}

/** @deprecated Prefer `sprite.setMap(map)`. */
export function setBillboardMap(actor: Pseudo3DSprite, map: import('three').Texture) {
  actor.setMap(map)
}
