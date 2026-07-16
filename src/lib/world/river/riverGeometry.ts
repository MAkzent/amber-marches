import { BufferAttribute, BufferGeometry, Color } from 'three'
import {
  RIVER_MAX_X,
  RIVER_MIN_X,
  WATER_SURFACE_Y,
  sampleRiverAxis,
} from '../data/silverrunChannel'
import { RIVER_PALETTE } from './riverConfig'

const shallow = new Color(RIVER_PALETTE.shallow)
const deep = new Color(RIVER_PALETTE.deep)
const ford = new Color(RIVER_PALETTE.ford)
const fordBed = new Color(RIVER_PALETTE.fordBed)
const color = new Color()

/**
 * Silverrun ribbon. Softer depth tints + ford weight feed the transparent
 * water shader; flow UVs drive surface waves without denser meshing.
 */
export function createRiverSurfaceGeometry(lengthSegments = 128, widthSegments = 8) {
  const vertices: number[] = []
  const colors: number[] = []
  const flow: number[] = []
  const fordAttr: number[] = []
  const depthAttr: number[] = []
  const indices: number[] = []

  for (let index = 0; index <= lengthSegments; index += 1) {
    const t = index / lengthSegments
    const axis = sampleRiverAxis(RIVER_MIN_X + t * (RIVER_MAX_X - RIVER_MIN_X))

    for (let across = 0; across <= widthSegments; across += 1) {
      const u = across / widthSegments
      const offset = (u * 2 - 1) * axis.waterHalfWidth
      vertices.push(
        axis.x + axis.normalX * offset,
        WATER_SURFACE_Y,
        axis.centerZ + axis.normalZ * offset,
      )

      const edgeDistance = Math.min(u, 1 - u) * 2
      const depth = edgeDistance * edgeDistance * (3 - 2 * edgeDistance)
      // Bank→center gradient: darker channel so caustics read; ford stays clearer.
      const depthTint = depth * 0.72 * (1 - axis.fordBlend * 0.9)
      const flowVariation = Math.sin(axis.flowDistance * 0.34 + u * 2.4) * 0.014
      color.copy(shallow).lerp(deep, depthTint)
      color.lerp(ford, axis.fordBlend * 0.78)
      const fordRipple = Math.sin(axis.flowDistance * 1.15 + u * 5.2) * 0.5 + 0.5
      color.lerp(fordBed, axis.fordBlend * (0.1 + fordRipple * 0.14))
      colors.push(
        Math.max(0, color.r + flowVariation * 0.55),
        Math.max(0, color.g + flowVariation),
        Math.max(0, color.b + flowVariation * 0.75),
      )
      flow.push(u, axis.flowDistance * 0.085)
      fordAttr.push(axis.fordBlend)
      // 0 = bank/shallow shelf, 1 = channel center. Ford pulls toward shallow.
      depthAttr.push(Math.max(0, depth * (1 - axis.fordBlend * 0.92)))
    }

    if (index < lengthSegments) {
      const stride = widthSegments + 1
      const row = index * stride
      for (let across = 0; across < widthSegments; across += 1) {
        const a = row + across
        const b = a + stride
        indices.push(a, a + 1, b, b, a + 1, b + 1)
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.setAttribute('aFlow', new BufferAttribute(new Float32Array(flow), 2))
  geometry.setAttribute('aFord', new BufferAttribute(new Float32Array(fordAttr), 1))
  geometry.setAttribute('aDepth', new BufferAttribute(new Float32Array(depthAttr), 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  if (geometry.boundingSphere) geometry.boundingSphere.radius += 0.08
  return geometry
}

/** @deprecated River geometry is owned by the Silverrun module. */
export const createRiverGeometry = createRiverSurfaceGeometry
