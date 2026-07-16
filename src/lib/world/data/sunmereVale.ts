export type Landmark = {
  id: string
  model: string
  position: [number, number, number]
  rotation?: [number, number, number]
  scale: number
}

export type SceneryPoint = {
  x: number
  z: number
  scale: number
  hue: number
  kind: 'oak' | 'pine' | 'rock' | 'flower'
}

const seeded = (seed: number) => {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0xffffffff
  }
}

const random = seeded(0x51a7c0de)

export const WORLD_BOUNDS = { minX: -43, maxX: 43, minZ: -31, maxZ: 29 }

export const landmarks: Landmark[] = [
  {
    id: 'house-west',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/house.gltf.glb',
    position: [-13, 0.4, 10],
    rotation: [0, 0.35, 0],
    scale: 2.4,
  },
  {
    id: 'market',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/market.gltf.glb',
    position: [-5, 0.25, 11],
    rotation: [0, -0.55, 0],
    scale: 2.15,
  },
  {
    id: 'mill',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/mill.gltf.glb',
    position: [-20, 0.5, 14],
    rotation: [0, 0.2, 0],
    scale: 2.4,
  },
  {
    id: 'well',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/well.gltf.glb',
    position: [-8, 0.28, 7],
    scale: 2.2,
  },
  {
    id: 'silverrun-bridge',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/bridge_roofed.gltf.glb',
    position: [6, 0.25, -2],
    rotation: [0, Math.PI / 2, 0],
    scale: 2.05,
  },
  {
    id: 'watchtower',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/watchtower.gltf.glb',
    position: [22, 1.5, -22],
    rotation: [0, -0.35, 0],
    scale: 3.05,
  },
  {
    id: 'shrine-ring',
    model: '/assets/cc0/kenney-nature/Models/GLTF format/statue_ring.glb',
    position: [-20, 0.8, -16],
    rotation: [0, 0.2, 0],
    scale: 2.8,
  },
]

/**
 * Landmark blockers — large enough to cover visible KayKit footprints, but with
 * corridor gaps so the village road between house / well / market stays passable.
 */
export const collisionCircles = [
  { x: -13, z: 10, radius: 3.45 },
  { x: -5, z: 11, radius: 3.05 },
  { x: -20, z: 14, radius: 3.7 },
  { x: -8, z: 7, radius: 1.45 },
  { x: 22, z: -22, radius: 3.55 },
  { x: -20, z: -16, radius: 2.35 },
]

export const scenery: SceneryPoint[] = []

function blocksClearing(x: number, z: number) {
  const riverDistance = Math.abs(z - riverCenter(x))
  const villageDistance = Math.hypot(x + 9, z - 10)
  const bridgeDistance = Math.hypot(x - 6, z + 2)
  const shrineDistance = Math.hypot(x + 20, z + 16)
  const towerDistance = Math.hypot(x - 22, z + 22)
  return (
    riverDistance < 5.2 ||
    villageDistance < 9 ||
    bridgeDistance < 6.5 ||
    shrineDistance < 5 ||
    towerDistance < 6
  )
}

function nearTree(x: number, z: number, minDist: number) {
  for (const point of scenery) {
    if (point.kind !== 'oak' && point.kind !== 'pine') continue
    if (Math.hypot(point.x - x, point.z - z) < minDist) return true
  }
  return false
}

function pushTree(x: number, z: number, pineChance: number) {
  if (blocksClearing(x, z)) return
  // Condensed stands: allow trunks closer than the old sparse scatter.
  if (nearTree(x, z, 1.25)) return
  scenery.push({
    x,
    z,
    scale: 0.72 + random() * 0.7,
    hue: random(),
    kind: random() < pineChance ? 'pine' : 'oak',
  })
}

/** Dense forest pockets wrapping the vale — trees cluster toward each center. */
const forestClusters = [
  { x: 30, z: 9, count: 52, radius: 12.5, pineChance: 0.28 },
  { x: -31, z: -5, count: 48, radius: 11.5, pineChance: 0.35 },
  { x: 22, z: -15, count: 44, radius: 10.5, pineChance: 0.42 },
  { x: -25, z: 15, count: 38, radius: 9.5, pineChance: 0.22 },
  { x: 12, z: 17, count: 34, radius: 8.5, pineChance: 0.18 },
  { x: -16, z: -22, count: 36, radius: 9.5, pineChance: 0.48 },
  { x: 34, z: -18, count: 30, radius: 8.5, pineChance: 0.4 },
  { x: -35, z: 5, count: 28, radius: 8, pineChance: 0.3 },
  { x: 6, z: -24, count: 26, radius: 7.5, pineChance: 0.55 },
  { x: -8, z: 20, count: 22, radius: 7, pineChance: 0.2 },
] as const

for (const cluster of forestClusters) {
  for (let i = 0; i < cluster.count; i += 1) {
    const angle = random() * Math.PI * 2
    // Power < 1 packs more trees near the cluster core.
    const r = cluster.radius * Math.pow(random(), 0.48)
    pushTree(cluster.x + Math.cos(angle) * r, cluster.z + Math.sin(angle) * r, cluster.pineChance)
  }
}

// Light fringe along the world rim so the horizon still reads as woods.
for (let i = 0; i < 40; i += 1) {
  const side = Math.floor(random() * 4)
  let x = (random() - 0.5) * 88
  let z = (random() - 0.5) * 62
  if (side === 0) x = -34 - random() * 10
  if (side === 1) x = 34 + random() * 10
  if (side === 2) z = -25 - random() * 7
  if (side === 3) z = 23 + random() * 7
  pushTree(x, z, 0.35)
}

// Sparse rocks / wildflowers in the open ground between stands.
for (let i = 0; i < 55; i += 1) {
  const x = (random() - 0.5) * 80
  const z = (random() - 0.5) * 56
  if (blocksClearing(x, z)) continue
  if (nearTree(x, z, 2.2)) continue
  const roll = random()
  scenery.push({
    x,
    z,
    scale: 0.7 + random() * 0.7,
    hue: random(),
    kind: roll < 0.62 ? 'rock' : 'flower',
  })
}

export const roadPaths: Array<Array<[number, number]>> = [
  [
    [1, 24],
    [-2, 18],
    [-8, 11],
    [-3, 5],
    [6, -2],
    [11, -9],
    [22, -22],
  ],
  [
    [6, -2],
    [-3, -8],
    [-11, -11],
    [-20, -16],
  ],
  [
    [-8, 11],
    [-14, 12],
    [-20, 14],
  ],
]

/**
 * Silverrun bridge deck — shared by walkHeight, river gate, and isWalkable.
 * deckY must match the placed GLB: terrainHeight(6,-2) + landmarkY + deckLocalY * scale
 * ≈ -0.46 + 0.25 + 0.277 * 2.05 ≈ 0.36 (plus a tiny foot bias applied at runtime).
 */
export const SILVERRUN_BRIDGE = {
  x: 6,
  z: -2,
  /** Half-extents of the deck ellipse in XZ. */
  radiusX: 3.5,
  radiusZ: 2.5,
  deckY: 0.42,
} as const

/**
 * Half-width of the impassable river channel (point sample; add hero radius at runtime).
 * Matches the visual bank strip (createRiverGeometry width 7.4 → half ≈ 3.7) so heroes
 * cannot stand inside the carved bowl / water meshes.
 */
export const RIVER_HALF_WIDTH = 3.45

export function riverCenter(x: number) {
  return -2 + Math.sin((x - 6) * 0.095) * 1.65
}

/**
 * Ellipse membership for the bridge deck.
 * `margin` expands (>0) or shrinks (<0) the ellipse in world units.
 */
export function onBridgeDeck(x: number, z: number, margin = 0) {
  const rx = SILVERRUN_BRIDGE.radiusX + margin
  const rz = SILVERRUN_BRIDGE.radiusZ + margin
  if (rx <= 1e-6 || rz <= 1e-6) return false
  const bx = (x - SILVERRUN_BRIDGE.x) / rx
  const bz = (z - SILVERRUN_BRIDGE.z) / rz
  return bx * bx + bz * bz <= 1
}

/** 1 at deck center → 0 at ellipse edge (and outside). */
export function bridgeDeckBlend(x: number, z: number) {
  const bx = (x - SILVERRUN_BRIDGE.x) / SILVERRUN_BRIDGE.radiusX
  const bz = (z - SILVERRUN_BRIDGE.z) / SILVERRUN_BRIDGE.radiusZ
  return Math.max(0, 1 - Math.hypot(bx, bz))
}

export function terrainHeight(x: number, z: number) {
  const broad = Math.sin(x * 0.085) * 0.52 + Math.cos(z * 0.11) * 0.42
  const rolling = Math.sin((x + z) * 0.13) * 0.25
  const river = Math.exp(-Math.pow((z - riverCenter(x)) / 4.1, 2)) * 1.25
  const towerRise = Math.exp(-((x - 22) ** 2 + (z + 22) ** 2) / 95) * 2.8
  const farDistance = Math.max(0, -z - 27)
  const farRise = farDistance * farDistance * 0.008
  return broad + rolling - river + towerRise + farRise
}

/**
 * Surface the party stands on — analytical terrain plus the Silverrun deck.
 * Houses/buildings are solid XZ blockers (see collision.ts); they are not walk surfaces.
 */
export function walkHeight(x: number, z: number) {
  const ground = terrainHeight(x, z)
  const blend = bridgeDeckBlend(x, z)
  if (blend <= 0) return ground
  // Smoothstep-ish: quadratic falloff keeps approaches from popping.
  const t = blend * blend
  return ground + (SILVERRUN_BRIDGE.deckY - ground) * t
}

export function sceneryColliderRadius(point: SceneryPoint): number | null {
  switch (point.kind) {
    case 'oak':
      // Quaternius CommonTree trunk footprint at ~0.58 world scale.
      return 0.43 * point.scale
    case 'pine':
      return 0.37 * point.scale
    case 'rock':
      return 0.85 * point.scale
    case 'flower':
      return null
  }
}

/** Point-sample walkability (radius 0). Runtime movement uses collision.isFree with HERO_RADIUS. */
export function isWalkable(x: number, z: number) {
  if (x < WORLD_BOUNDS.minX || x > WORLD_BOUNDS.maxX || z < WORLD_BOUNDS.minZ || z > WORLD_BOUNDS.maxZ) {
    return false
  }
  const inRiver = Math.abs(z - riverCenter(x)) < RIVER_HALF_WIDTH
  if (inRiver && !onBridgeDeck(x, z)) return false
  if (collisionCircles.some((circle) => Math.hypot(circle.x - x, circle.z - z) < circle.radius)) {
    return false
  }
  for (const point of scenery) {
    const radius = sceneryColliderRadius(point)
    if (radius == null) continue
    if (Math.hypot(point.x - x, point.z - z) < radius) return false
  }
  return true
}
