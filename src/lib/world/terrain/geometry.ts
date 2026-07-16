import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  PlaneGeometry,
  Vector3,
} from 'three'
import { sampleRiver, terrainHeight, walkHeight } from '../data/sunmereVale'

const grassLow = new Color('#4d6037')
const grassHigh = new Color('#98964c')
const dryGrass = new Color('#a16f3e')
const riverBank = new Color('#8d7948')
const wetBank = new Color('#52604a')
const distant = new Color('#4f6249')
const mistCliff = new Color('#6a6578')

export function createTerrainGeometry() {
  const geometry = new PlaneGeometry(150, 150, 128, 128)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const color = new Color()

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const z = positions.getZ(index)
    const y = terrainHeight(x, z)
    positions.setY(index, y)

    const altitude = Math.max(0, Math.min(1, (y + 1.3) / 5))
    const broadPatch =
      (Math.sin(x * 0.17 + Math.sin(z * 0.11) * 1.8) +
        Math.cos(z * 0.19 + Math.sin(x * 0.13) * 2.1)) *
        0.25 +
      0.5
    const dryPatch =
      Math.sin(x * 0.31 + z * 0.23) * Math.sin(x * 0.17 - z * 0.29) * 0.5 + 0.5
    color.copy(grassLow).lerp(grassHigh, altitude * 0.62 + broadPatch * 0.08)
    color.lerp(dryGrass, dryPatch * (0.1 + broadPatch * 0.14))
    const river = sampleRiver(x, z)
    if (river.inBank) {
      const bankStrength = 1 - river.bank01
      color.lerp(riverBank, 0.3 + bankStrength * 0.38)
      if (river.inWater) color.lerp(wetBank, 0.4 + (1 - river.water01) * 0.38)
    }
    if (z < -25) color.lerp(distant, Math.min(0.7, (-z - 25) / 10))
    const mistNear = Math.exp(-((x + 14) ** 2 + (z + 24) ** 2) / 70)
    if (mistNear > 0.12) color.lerp(mistCliff, mistNear * 0.55)

    const fineVariation =
      Math.sin(x * 1.73 + z * 2.11) * 0.018 +
      Math.sin(x * 3.31 - z * 1.47) * 0.009
    colors[index * 3] = Math.max(0, color.r + fineVariation * 1.14)
    colors[index * 3 + 1] = Math.max(0, color.g + fineVariation)
    colors[index * 3 + 2] = Math.max(0, color.b + fineVariation * 0.58)
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function createRoadGeometry(points: Array<[number, number]>, width = 1.65) {
  // Follow walkHeight so approaches rise toward the Silverrun deck.
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, walkHeight(x, z) + 0.06, z)))
  const segments = Math.max(12, points.length * 10)
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const wetFlags: boolean[] = []
  const up = new Vector3(0, 1, 0)
  const tangent = new Vector3()
  const side = new Vector3()

  /**
   * Gap the entire open channel. A prior "keep deck strip" painted dirt over
   * the ford so the river looked like it stopped before the bridge from above.
   * The dedicated stone deck is the only crossing surface; roads stop at its aprons.
   */
  const roadCrossesOpenWater = (x: number, z: number) =>
    sampleRiver(x, z).inWater

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const point = curve.getPointAt(t)
    point.y = walkHeight(point.x, point.z) + 0.095
    curve.getTangentAt(t, tangent)
    side.crossVectors(up, tangent).normalize().multiplyScalar(width / 2)

    vertices.push(point.x + side.x, point.y, point.z + side.z)
    vertices.push(point.x - side.x, point.y, point.z - side.z)
    uvs.push(0, t * 8, 1, t * 8)
    wetFlags.push(roadCrossesOpenWater(point.x, point.z))
  }

  for (let index = 0; index < segments; index += 1) {
    if (wetFlags[index] || wetFlags[index + 1]) continue
    const base = index * 2
    indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** @deprecated River geometry lives in ../river/riverGeometry. */
export { createRiverSurfaceGeometry as createRiverGeometry } from '../river/riverGeometry'
