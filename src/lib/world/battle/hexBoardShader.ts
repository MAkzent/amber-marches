/**
 * Shared hex-board GLSL + cell-kind atlas for the battle overlay.
 * Mirrors pointy-top axial math in hexsim/hex.ts and projection.ts.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  UnsignedByteType,
} from 'three'
import {
  hexesWithin,
  hexToWorldXZ,
  type BoardOrigin,
  type Hex,
} from '../../battle'
import { walkHeight } from '../data/sunmereVale'

/** Atlas codes — stored as raw bytes, sampled as r*255 in the shader. */
export const CELL_KIND = {
  blocked: 0,
  plain: 1,
  heroDeploy: 2,
  enemyDeploy: 3,
} as const

export type CellKindCode = (typeof CELL_KIND)[keyof typeof CELL_KIND]

export function atlasSize(radius: number): number {
  return 2 * radius + 1
}

/** Row-major index for axial (q,r) in a (2R+1)² atlas centered at (0,0). */
export function atlasIndex(q: number, r: number, radius: number): number {
  const size = atlasSize(radius)
  return (r + radius) * size + (q + radius)
}

export function packCellKindData(
  radius: number,
  options: {
    heroDeploy: readonly Hex[]
    enemyDeploy: readonly Hex[]
    blocked: readonly Hex[]
  },
): Uint8Array {
  const size = atlasSize(radius)
  const data = new Uint8Array(size * size)

  for (const hex of hexesWithin({ q: 0, r: 0 }, radius)) {
    data[atlasIndex(hex.q, hex.r, radius)] = CELL_KIND.plain
  }
  for (const hex of options.blocked) {
    const i = atlasIndex(hex.q, hex.r, radius)
    if (i >= 0 && i < data.length) data[i] = CELL_KIND.blocked
  }
  for (const hex of options.heroDeploy) {
    const i = atlasIndex(hex.q, hex.r, radius)
    if (i >= 0 && i < data.length && data[i] !== CELL_KIND.blocked) {
      data[i] = CELL_KIND.heroDeploy
    }
  }
  for (const hex of options.enemyDeploy) {
    const i = atlasIndex(hex.q, hex.r, radius)
    if (i >= 0 && i < data.length && data[i] !== CELL_KIND.blocked) {
      data[i] = CELL_KIND.enemyDeploy
    }
  }
  return data
}

export function createCellKindTexture(data: Uint8Array, radius: number): DataTexture {
  const size = atlasSize(radius)
  const tex = new DataTexture(data, size, size, RedFormat, UnsignedByteType)
  tex.minFilter = NearestFilter
  tex.magFilter = NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/**
 * Subdivided XZ plane whose vertices follow walkHeight so the hex filter
 * drapes over slopes instead of clipping into the heightfield.
 * Mesh should be positioned at (origin.x, 0, origin.z).
 */
export function createDrapedPlaneGeometry(
  span: number,
  origin: { x: number; z: number },
  lift: number,
  segmentWorld = 0.35,
): PlaneGeometry {
  const segs = Math.max(16, Math.ceil(span / segmentWorld))
  const geo = new PlaneGeometry(span, span, segs, segs)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const wx = origin.x + pos.getX(i)
    const wz = origin.z + pos.getZ(i)
    pos.setY(i, walkHeight(wx, wz) + lift)
  }
  pos.needsUpdate = true
  geo.computeBoundingSphere()
  geo.computeBoundingBox()
  return geo
}

/**
 * Inset hex patches that follow the analytical walk surface.
 * Geometry stays local to `origin`; every vertex samples its own natural Y so
 * hills remain untouched and the tint reads as a ground skin, not a platform.
 */
export function createTerrainHexPatchGeometry(
  origin: BoardOrigin,
  hexSize: number,
  radius: number,
  lift: number,
  inset = 0.95,
): BufferGeometry {
  const edgeSubdivisions = 4
  const perimeterCount = 6 * edgeSubdivisions
  const innerScale = 0.5
  const positions: number[] = []
  const indices: number[] = []

  for (const hex of hexesWithin({ q: 0, r: 0 }, radius)) {
    const center = hexToWorldXZ(hex, origin, hexSize)
    const base = positions.length / 3
    positions.push(
      center.x - origin.x,
      walkHeight(center.x, center.z) + lift,
      center.z - origin.z,
    )

    const outer: { x: number; z: number }[] = []
    for (let edge = 0; edge < 6; edge += 1) {
      const a = (Math.PI / 180) * (60 * edge - 30) + (origin.yaw ?? 0)
      const b = (Math.PI / 180) * (60 * (edge + 1) - 30) + (origin.yaw ?? 0)
      const ax = Math.cos(a) * hexSize * inset
      const az = Math.sin(a) * hexSize * inset
      const bx = Math.cos(b) * hexSize * inset
      const bz = Math.sin(b) * hexSize * inset
      for (let step = 0; step < edgeSubdivisions; step += 1) {
        const t = step / edgeSubdivisions
        outer.push({
          x: ax + (bx - ax) * t,
          z: az + (bz - az) * t,
        })
      }
    }

    for (const point of outer) {
      const wx = center.x + point.x * innerScale
      const wz = center.z + point.z * innerScale
      positions.push(wx - origin.x, walkHeight(wx, wz) + lift, wz - origin.z)
    }
    for (const point of outer) {
      const wx = center.x + point.x
      const wz = center.z + point.z
      positions.push(wx - origin.x, walkHeight(wx, wz) + lift, wz - origin.z)
    }

    const innerStart = base + 1
    const outerStart = innerStart + perimeterCount
    for (let i = 0; i < perimeterCount; i += 1) {
      const next = (i + 1) % perimeterCount
      indices.push(base, innerStart + i, innerStart + next)
      indices.push(innerStart + i, outerStart + i, outerStart + next)
      indices.push(innerStart + i, outerStart + next, innerStart + next)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  geo.computeBoundingBox()
  return geo
}

/**
 * World XZ → local board → fractional axial + cube round + hex distance.
 * Also exposes a pointy-top in-hex edge factor (0 centre → 0.5 boundary).
 */
export const HEX_BOARD_GLSL = /* glsl */ `
const float HEX_SQRT3 = 1.73205080757;

vec2 worldToLocalXZ(vec2 worldXZ, vec2 origin, float yaw) {
  float c = cos(yaw);
  float s = sin(yaw);
  vec2 d = worldXZ - origin;
  return vec2(d.x * c + d.y * s, -d.x * s + d.y * c);
}

vec2 localToAxial(vec2 local, float hexSize) {
  float q = ((HEX_SQRT3 / 3.0) * local.x - (1.0 / 3.0) * local.y) / hexSize;
  float r = ((2.0 / 3.0) * local.y) / hexSize;
  return vec2(q, r);
}

vec3 axialToCube(vec2 qr) {
  return vec3(qr.x, qr.y, -qr.x - qr.y);
}

ivec2 hexRound(vec2 qr) {
  vec3 cube = axialToCube(qr);
  vec3 rounded = floor(cube + 0.5);
  vec3 diff = abs(rounded - cube);
  if (diff.x > diff.y && diff.x > diff.z) {
    rounded.x = -rounded.y - rounded.z;
  } else if (diff.y > diff.z) {
    rounded.y = -rounded.x - rounded.z;
  }
  return ivec2(int(rounded.x), int(rounded.y));
}

float hexDistanceAxial(vec2 qr) {
  vec3 c = abs(axialToCube(qr));
  return max(c.x, max(c.y, c.z));
}

/** 0 at hex centre, 0.5 at shared edges (cube fractional distance). */
float hexEdgeFactor(vec2 qr, ivec2 cell) {
  vec3 cube = axialToCube(qr);
  vec3 center = vec3(float(cell.x), float(cell.y), float(-cell.x - cell.y));
  vec3 d = abs(cube - center);
  return max(d.x, max(d.y, d.z));
}

int sampleCellKind(sampler2D atlas, ivec2 cell, int atlasRadius) {
  int size = 2 * atlasRadius + 1;
  int x = cell.x + atlasRadius;
  int y = cell.y + atlasRadius;
  if (x < 0 || y < 0 || x >= size || y >= size) return 0;
  vec2 uv = (vec2(float(x), float(y)) + 0.5) / float(size);
  return int(floor(texture2D(atlas, uv).r * 255.0 + 0.5));
}
`
