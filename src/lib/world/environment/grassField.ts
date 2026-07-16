/**
 * Low-cut meadow grass for Sunmere Vale — Kenney Nature Kit CC0 tufts
 * (`grass.glb` ~0.25m, `grass_leafs.glb` ~0.14m) as InstancedMeshes.
 *
 * Placement grows up to landmark walls (only the solid footprint is cleared).
 * GPU wind + foot discs (party + fading trail). Tiles frustum-cull. Shadows on.
 */

import {
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshToonMaterial,
  Object3D,
  Vector2,
  Vector4,
  type BufferGeometry,
  type IUniform,
  type Material,
} from 'three'
import { WIND } from '../atmosphere/wind'
import {
  collisionCircles,
  onAscentTreads,
  onBridgeDeck,
  roadPaths,
  sampleRiver,
  scenery,
  walkHeight,
  WORLD_BOUNDS,
} from '../data/sunmereVale'
import { gbaToonGradient } from '../render/retroPalette'

export const MAX_BENDERS = 12
const TILE = 14

/** Kenney grass local height ≈ 0.254 — scale into a short readable carpet. */
const GRASS_SCALE_MIN = 1.05
const GRASS_SCALE_MAX = 1.55
const LEAF_SCALE_MIN = 1.15
const LEAF_SCALE_MAX = 1.7

const GRASS_TINT = new Color('#6f8644')
const LEAF_TINT = new Color('#7a9148')
const GUST_SILVER = new Color('#b8c878')
const TRAMPLE_DARK = new Color('#2a3320')

export const KENNEY_GRASS_URL = '/assets/cc0/kenney-nature/Models/GLTF format/grass.glb'
export const KENNEY_GRASS_LEAFS_URL = '/assets/cc0/kenney-nature/Models/GLTF format/grass_leafs.glb'

export type GrassBender = { x: number; z: number; r: number }

export type GrassTuft = {
  x: number
  y: number
  z: number
  scale: number
  yaw: number
  kind: 'grass' | 'leafs'
}

export type GrassFieldHandle = {
  root: Group
  setTime: (t: number) => void
  setWindStrength: (strength: number) => void
  setBenders: (benders: GrassBender[]) => void
  dispose: () => void
}

function distToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-8) return Math.hypot(px - ax, pz - az)
  let t = ((px - ax) * dx + (pz - az) * dz) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

function nearRoad(x: number, z: number): boolean {
  for (let pathIndex = 0; pathIndex < roadPaths.length; pathIndex += 1) {
    const path = roadPaths[pathIndex]
    const half = pathIndex === 0 ? 1.05 : 0.78
    for (let i = 0; i < path.length - 1; i += 1) {
      const [ax, az] = path[i]
      const [bx, bz] = path[i + 1]
      if (distToSegment(x, z, ax, az, bx, bz) < half) return true
    }
  }
  return false
}

/**
 * Only clear solid footprints — grass grows right up to KayKit walls.
 * (Previously a big village disc + oversized circle padding left bare dirt rings.)
 */
export function blocksGrass(x: number, z: number): boolean {
  if (onBridgeDeck(x, z, 0.55)) return true
  if (sampleRiver(x, z).inBank) return true
  if (nearRoad(x, z)) return true
  // Stone treads stay clear; mid-landing meadow keeps tufts (onAscentTreads excludes it).
  if (onAscentTreads(x, z)) return true
  for (const circle of collisionCircles) {
    if (Math.hypot(circle.x - x, circle.z - z) < circle.radius * 0.9) return true
  }
  for (const point of scenery) {
    if (point.kind !== 'oak' && point.kind !== 'pine') continue
    const trunk = (point.kind === 'oak' ? 0.5 : 0.44) * point.scale
    if (Math.hypot(point.x - x, point.z - z) < trunk) return true
  }
  return false
}

function hash2(x: number, z: number, salt = 0): number {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453
  return n - Math.floor(n)
}

/** Desktop meadow step; mobile uses a wider step to cut instance count ~in half. */
export const GRASS_STEP_DESKTOP = 0.42
export const GRASS_STEP_MOBILE = 0.72

/** Dense Kenney tuft lattice — each instance is already a multi-blade cluster. */
export function sampleGrassTufts(step = GRASS_STEP_DESKTOP): GrassTuft[] {
  const tufts: GrassTuft[] = []
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS

  for (let gz = minZ; gz <= maxZ; gz += step) {
    for (let gx = minX; gx <= maxX; gx += step) {
      const jx = (hash2(gx, gz, 1) - 0.5) * step * 0.9
      const jz = (hash2(gx, gz, 2) - 0.5) * step * 0.9
      const x = gx + jx
      const z = gz + jz
      if (blocksGrass(x, z)) continue

      const village = Math.hypot(x + 9, z - 10)
      // Village yards get *more* tufts so buildings sit in a lawn, not a dirt moat.
      const yardBoost = village < 14 ? 0.34 : village < 28 ? 0.18 : 0
      const patch =
        0.7 +
        0.2 * Math.sin(x * 0.11 + z * 0.09) * Math.cos(x * 0.07 - z * 0.13) +
        yardBoost
      const rim = Math.min(x - minX, maxX - x, z - minZ, maxZ - z)
      const edge = rim < 3 ? 0.25 : rim < 6.5 ? 0.58 : 1
      const keep = hash2(x, z, 3)
      if (keep > Math.min(0.98, (0.7 + patch * 0.28) * edge)) continue

      const clump = keep < 0.16 ? 2 : keep < 0.38 ? 1 : 0
      for (let c = 0; c <= clump; c += 1) {
        const ox = c === 0 ? 0 : (hash2(x, z, 10 + c) - 0.5) * 0.28
        const oz = c === 0 ? 0 : (hash2(x, z, 20 + c) - 0.5) * 0.28
        const bx = x + ox
        const bz = z + oz
        if (blocksGrass(bx, bz)) continue
        const leaf = hash2(bx, bz, 8) < 0.22
        const s = hash2(bx, bz, 4)
        tufts.push({
          x: bx,
          y: walkHeight(bx, bz) + 0.008,
          z: bz,
          scale: leaf
            ? LEAF_SCALE_MIN + s * (LEAF_SCALE_MAX - LEAF_SCALE_MIN)
            : GRASS_SCALE_MIN + s * (GRASS_SCALE_MAX - GRASS_SCALE_MIN),
          yaw: hash2(bx, bz, 6) * Math.PI * 2,
          kind: leaf ? 'leafs' : 'grass',
        })
      }
    }
  }

  return tufts
}

function attachGrassShader(
  material: MeshToonMaterial,
  uniforms: Record<string, IUniform>,
  localHeight: number,
) {
  const h = localHeight.toFixed(4)
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        uniform vec2 uWindDir;
        uniform vec4 uBenders[${MAX_BENDERS}];
        varying float vGust;
        varying float vTrample;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vGust = 0.0;
        vTrample = 0.0;
        #ifdef USE_INSTANCING
        {
          vec3 root = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float yw = max(transformed.y, 0.0);
          float hNorm = clamp(yw / ${h}, 0.0, 1.0);
          float h2 = hNorm * hNorm;

          // One soft press field — take the strongest disc, never sum them
          // (party + trail used to stack and stretch tufts sideways).
          vec2 pushDir = vec2(0.0);
          float press = 0.0;
          for (int i = 0; i < ${MAX_BENDERS}; i++) {
            vec4 b = uBenders[i];
            if (b.z < 0.05) continue;
            vec2 d = root.xz - b.xy;
            float dist = max(length(d), 0.001);
            float k = 1.0 - smoothstep(0.35 * b.z, b.z, dist);
            if (k > press) {
              press = k;
              pushDir = d / dist;
            }
          }

          vec2 along = uWindDir * uTime;
          float dirN = fract(sin(dot(root.xz, vec2(127.1, 311.7))) * 43758.5453) * 2.0 - 1.0;
          float gustN = fract(sin(dot(root.xz * 0.22 - along * 0.55, vec2(269.5, 183.3))) * 43758.5453) * 2.0 - 1.0;
          float gust01 = clamp(gustN * 0.5 + 0.5, 0.0, 1.0);
          gust01 *= gust01;
          // Ambient breeze only — mute underfoot so wind + trample don't fight.
          float windAmt = uWind * (0.06 + 0.22 * gust01) * (1.0 - press * 0.85) * h2;
          float theta = atan(uWindDir.y, uWindDir.x) + dirN * 0.35;

          float c = instanceMatrix[0][0];
          float s = instanceMatrix[0][2];
          // Subtle tip sway: wind lean + a small radial part (no long rubber blades).
          vec2 worldOff =
            vec2(cos(theta), sin(theta)) * windAmt * ${h} * 0.55 +
            pushDir * press * h2 * 0.11;
          vec2 localOff = vec2(c * worldOff.x + s * worldOff.y, -s * worldOff.x + c * worldOff.y);

          transformed.y *= mix(1.0, 0.78, press * hNorm);
          transformed.x += localOff.x;
          transformed.z += localOff.y;
          vGust = gust01 * (1.0 - press * 0.7);
          vTrample = press;
        }
        #endif`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uGustTint;
        uniform vec3 uTrampleDark;
        varying float vGust;
        varying float vTrample;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, uGustTint, vGust * 0.1);
        diffuseColor.rgb = mix(diffuseColor.rgb, uTrampleDark, vTrample * 0.22);`,
      )
  }

  material.customProgramCacheKey = () => `kenney-grass-subtle-v2-${h}`
}

function bucketTufts(tufts: GrassTuft[]): Map<string, GrassTuft[]> {
  const tiles = new Map<string, GrassTuft[]>()
  for (const tuft of tufts) {
    const key = `${Math.floor(tuft.x / TILE)}:${Math.floor(tuft.z / TILE)}`
    let list = tiles.get(key)
    if (!list) {
      list = []
      tiles.set(key, list)
    }
    list.push(tuft)
  }
  return tiles
}

function prepareGeometry(geometry: BufferGeometry): BufferGeometry {
  const geo = geometry.clone()
  // Kenney models sit on y=0; ensure normals for toon + shadow receive.
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  return geo
}

function makeMaterial(
  tint: Color,
  uniforms: Record<string, IUniform>,
  localHeight: number,
): MeshToonMaterial {
  const material = new MeshToonMaterial({
    color: tint,
    gradientMap: gbaToonGradient,
  })
  attachGrassShader(material, uniforms, localHeight)
  return material
}

function fillInstances(mesh: InstancedMesh, tufts: GrassTuft[]) {
  const dummy = new Object3D()
  for (let i = 0; i < tufts.length; i += 1) {
    const t = tufts[i]
    dummy.position.set(t.x, t.y, t.z)
    dummy.rotation.set(0, t.yaw, 0)
    dummy.scale.setScalar(t.scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  mesh.instanceMatrix.needsUpdate = true
  mesh.count = tufts.length
  mesh.computeBoundingSphere()
}

export function createKenneyGrassField(
  grassGeometry: BufferGeometry,
  leafGeometry: BufferGeometry,
  tufts = sampleGrassTufts(),
): GrassFieldHandle {
  const benderVecs = Array.from({ length: MAX_BENDERS }, () => new Vector4(0, 0, 0, 0))
  const uniforms: Record<string, IUniform> = {
    uTime: { value: 0 },
    uWind: { value: 0.55 },
    uWindDir: { value: new Vector2(WIND.dirX, WIND.dirZ) },
    uBenders: { value: benderVecs },
    uGustTint: { value: GUST_SILVER },
    uTrampleDark: { value: TRAMPLE_DARK },
  }

  const grassMat = makeMaterial(GRASS_TINT, uniforms, 0.254)
  const leafMat = makeMaterial(LEAF_TINT, uniforms, 0.1425)
  const grassGeo = prepareGeometry(grassGeometry)
  const leafGeo = prepareGeometry(leafGeometry)

  const root = new Group()
  root.name = 'sunmere-kenney-grass'
  const meshes: InstancedMesh[] = []
  const materials: Material[] = [grassMat, leafMat]

  for (const [, tileTufts] of bucketTufts(tufts)) {
    const grasses = tileTufts.filter((t) => t.kind === 'grass')
    const leafs = tileTufts.filter((t) => t.kind === 'leafs')

    if (grasses.length > 0) {
      const mesh = new InstancedMesh(grassGeo, grassMat, grasses.length)
      mesh.frustumCulled = true
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.renderOrder = 1
      fillInstances(mesh, grasses)
      root.add(mesh)
      meshes.push(mesh)
    }
    if (leafs.length > 0) {
      const mesh = new InstancedMesh(leafGeo, leafMat, leafs.length)
      mesh.frustumCulled = true
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.renderOrder = 1
      fillInstances(mesh, leafs)
      root.add(mesh)
      meshes.push(mesh)
    }
  }

  return {
    root,
    setTime(t) {
      uniforms.uTime.value = t
    },
    setWindStrength(strength) {
      uniforms.uWind.value = strength
    },
    setBenders(benders) {
      for (let i = 0; i < MAX_BENDERS; i += 1) {
        const b = benders[i]
        if (b) benderVecs[i].set(b.x, b.z, b.r, 0)
        else benderVecs[i].set(0, 0, 0, 0)
      }
    },
    dispose() {
      for (const mesh of meshes) {
        root.remove(mesh)
        mesh.dispose()
      }
      grassGeo.dispose()
      leafGeo.dispose()
      for (const mat of materials) mat.dispose()
    },
  }
}

/** @deprecated kept for tests that still sample placements */
export function sampleGrassBlades() {
  return sampleGrassTufts()
}
