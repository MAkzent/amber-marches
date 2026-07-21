import { groundedRootY, type TerrainPadMode } from './grounding'
import {
  WHISPERING_ASCENT,
  onAscentLane,
  sampleAscent,
  type AscentSample,
} from './mysteriousStairs'
import {
  SILVERRUN_SPAN,
  onSpanDeck,
  spanAbutments,
  spanDeckBlend,
  spanDeckHeight,
  spanPerp,
  spanYawFromAxis,
  type BridgeSpan,
} from '../build/crossings'
import { buildSnappedRoadNetwork } from '../build/snap'
import {
  RIVER_HALF_WIDTH,
  WATER_SURFACE_Y,
  riverCenter,
  sampleRiver,
  sampleRiverAxis,
} from './silverrunChannel'

export {
  WHISPERING_ASCENT,
  ASCENT_LENGTH,
  ascentBlend,
  ascentPointAt,
  ascentStones,
  ascentSurfaceY,
  ascentWalkY,
  onAscentLane,
  onAscentTreads,
  projectOntoAscent,
  sampleAscent,
} from './mysteriousStairs'

export {
  RIVER_HALF_WIDTH,
  WATER_SURFACE_Y,
  SILVERRUN_FORD_X,
  riverCenter,
  sampleRiver,
  sampleRiverAxis,
} from './silverrunChannel'
export { SILVERRUN_SPAN, BRIDGE_SPANS } from '../build/crossings'

export type Landmark = {
  id: string
  model: string
  /**
   * World XZ pivot. World Y is never authored — use `landmarkWorldPosition`
   * so props sit on the height field via footLocalY + contactBias + pad sample.
   */
  xz: [number, number]
  rotation?: [number, number, number]
  scale: number
  /**
   * Model-space Y of the visual foot (`bbox.min.y`). KayKit props sit on 0.
   * World foot = rootY + footLocalY * scale.
   */
  footLocalY?: number
  /**
   * Extra lift (+) / dig (-) after grounding. Keep tiny — large values recreate
   * the old "floating watchtower" bug (authored Y fighting terrainHeight).
   */
  contactBias?: number
  /**
   * Local XZ half-extent of the solid footprint (from GLB POSITION AABB).
   * World foot radius = footRadiusLocal * scale. Collider uses colliderFit on top.
   */
  footRadiusLocal: number
  /**
   * Shrink factor vs AABB disc so heroes can hug walls without tunneling.
   * Default 0.92. Set `blocksMovement: false` for walkable props (bridge).
   */
  colliderFit?: number
  /** When false, no solid disc — heroes walk through (Silverrun bridge). */
  blocksMovement?: boolean
  /** Footprint radius for slope pad sampling; defaults to world foot radius. */
  padRadius?: number
  padMode?: TerrainPadMode
}

/** World-space visual foot radius (AABB disc × scale). */
export function landmarkFootRadius(landmark: Landmark) {
  return landmark.footRadiusLocal * landmark.scale
}

/**
 * Solid movement disc. Sized from measured mesh bounds so discovery rings
 * remain reachable (collider + HERO_RADIUS < discovery.radius when centered).
 */
export function landmarkColliderRadius(landmark: Landmark): number | null {
  if (landmark.blocksMovement === false) return null
  return landmarkFootRadius(landmark) * (landmark.colliderFit ?? 0.92)
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

export const MISTCLIFF_MOUNTAIN = {
  x: -19.5,
  z: -28.2,
  radiusX: 8.3,
  radiusZ: 7.2,
  summitFraction: 0.5,
  height: 4.85,
} as const

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Flat-crowned rise with a compact, naturally blended mountain shoulder. */
export function mistcliffMountainRise(x: number, z: number) {
  const dx = (x - MISTCLIFF_MOUNTAIN.x) / MISTCLIFF_MOUNTAIN.radiusX
  const dz = (z - MISTCLIFF_MOUNTAIN.z) / MISTCLIFF_MOUNTAIN.radiusZ
  const radial = Math.hypot(dx, dz)
  return (
    MISTCLIFF_MOUNTAIN.height *
    (1 - smoothstep(MISTCLIFF_MOUNTAIN.summitFraction, 1, radial))
  )
}

/** Hero-clear summit around the far castle, with optional world-space padding. */
export function onMistcliffSummit(x: number, z: number, margin = 0) {
  const radiusX = Math.max(
    0.001,
    MISTCLIFF_MOUNTAIN.radiusX * MISTCLIFF_MOUNTAIN.summitFraction + margin,
  )
  const radiusZ = Math.max(
    0.001,
    MISTCLIFF_MOUNTAIN.radiusZ * MISTCLIFF_MOUNTAIN.summitFraction + margin,
  )
  return (
    ((x - MISTCLIFF_MOUNTAIN.x) / radiusX) ** 2 +
      ((z - MISTCLIFF_MOUNTAIN.z) / radiusZ) ** 2 <=
    1
  )
}

/**
 * Landmark props — footRadiusLocal values come from GLB POSITION accessor AABBs
 * (max of half-X / half-Z). Do not hand-inflate colliders; use colliderFit instead.
 */
export const landmarks: Landmark[] = [
  {
    id: 'house-west',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/house.gltf.glb',
    xz: [-13, 10],
    rotation: [0, 0.35, 0],
    scale: 2.4,
    footRadiusLocal: 0.844,
  },
  {
    id: 'market',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/market.gltf.glb',
    xz: [-5, 11],
    rotation: [0, -0.55, 0],
    scale: 2.15,
    footRadiusLocal: 0.837,
  },
  {
    id: 'mill',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/mill.gltf.glb',
    xz: [-20, 14],
    rotation: [0, 0.2, 0],
    scale: 2.4,
    footRadiusLocal: 0.844,
    // Body/fence sit on local y≈0 like other KayKit props. Do not use blade-mesh
    // AABB min.y (−0.689) — that is blade-local space and floats the mill by ~1.65.
  },
  {
    id: 'well',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/well.gltf.glb',
    xz: [-8, 7],
    scale: 2.2,
    footRadiusLocal: 0.509,
  },
  {
    id: 'watchtower',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/watchtower.gltf.glb',
    xz: [22, -22],
    rotation: [0, -0.35, 0],
    scale: 3.05,
    // AABB includes the side shack; cylinder alone is smaller — fit keeps approach open.
    footRadiusLocal: 0.857,
    // Mound lift comes from terrainHeight's towerRise — do not re-add it here.
  },
  {
    id: 'shrine-ring',
    model: '/assets/cc0/kenney-nature/Models/GLTF format/statue_ring.glb',
    xz: [-20, -16],
    rotation: [0, 0.2, 0],
    scale: 2.8,
    footRadiusLocal: 0.3,
  },
  {
    id: 'far-castle',
    model: '/assets/cc0/kaykit-medieval/Models/objects/gltf/castle.gltf.glb',
    // Sits west of the stair mouth so the summit arrival remains hero-width clear.
    xz: [-21.6, -28.9],
    rotation: [0, 0.55, 0],
    scale: 2.35,
    footRadiusLocal: 1.05,
    colliderFit: 0.78,
    padMode: 'center',
  },
]

/**
 * Landmark blockers — derived from measured mesh footprints, not hand-tuned discs.
 * Village road corridors stay open because house/market/well no longer overlap.
 */
export const collisionCircles = landmarks.flatMap((landmark) => {
  const radius = landmarkColliderRadius(landmark)
  if (radius == null) return []
  return [{ x: landmark.xz[0], z: landmark.xz[1], radius, landmarkId: landmark.id }]
})

/**
 * Authored road drafts — snap inserts abutments so paths meet the Silverrun
 * span on the banks, not as a dirt pad floating mid-channel.
 * Index 0 = main pilgrim road (width 1.5); others are branches (width 1.08).
 */
export const roadPaths: Array<Array<[number, number]>> = buildSnappedRoadNetwork([
  {
    // Loose ford waypoint at the span; snap rewrites to abutment → deck → abutment.
    waypoints: [
      [1, 24],
      [-2, 18],
      [-8, 11],
      [-3, 5],
      [SILVERRUN_SPAN.x, SILVERRUN_SPAN.z],
      [11, -9],
      [22, -22],
    ],
    crossSpanId: 'silverrun',
  },
  {
    // Shrine branch joins at the nearer abutment (Y-junction on the approach).
    waypoints: [
      [SILVERRUN_SPAN.x, SILVERRUN_SPAN.z],
      [-3, -8],
      [-11, -11],
      [-20, -16],
    ],
    joinSpanId: 'silverrun',
  },
  {
    waypoints: [
      [-8, 11],
      [-14, 12],
      [-20, 14],
    ],
  },
  // Spur from Shrinewood toward the Whispering Ascent.
  {
    waypoints: [
      [-20, -16],
      [-15.5, -16.2],
      [-12.5, -16.6],
      [-11.2, -17.0],
    ],
  },
])

/** Matches Terrain.svelte road strip widths. */
export const ROAD_WIDTHS = [1.5, 1.08, 1.08, 1.08] as const

/**
 * Min distance from road centerline that scenery must stay outside.
 * Sized for road half-width + hero disc (0.65) + max oak trunk (~0.61) + margin.
 */
export const ROAD_SCENERY_CLEARANCE = 2.2

/** Distance from (x,z) to the nearest point on a polyline of XZ waypoints. */
export function distanceToPolyline(x: number, z: number, path: Array<[number, number]>) {
  let minDist = Infinity
  for (let i = 0; i < path.length - 1; i += 1) {
    const [ax, az] = path[i]
    const [bx, bz] = path[i + 1]
    const dx = bx - ax
    const dz = bz - az
    const lenSq = dx * dx + dz * dz
    const t = lenSq < 1e-8 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lenSq))
    const px = ax + t * dx
    const pz = az + t * dz
    minDist = Math.min(minDist, Math.hypot(x - px, z - pz))
  }
  return minDist
}

export function distanceToNearestRoad(x: number, z: number) {
  let minDist = Infinity
  for (const path of roadPaths) {
    minDist = Math.min(minDist, distanceToPolyline(x, z, path))
  }
  return minDist
}

export function sampleRoadCenterline(
  path: Array<[number, number]>,
  spacing = 0.75,
): Array<[number, number]> {
  const samples: Array<[number, number]> = []
  for (let i = 0; i < path.length - 1; i += 1) {
    const [ax, az] = path[i]
    const [bx, bz] = path[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const steps = Math.max(1, Math.ceil(len / spacing))
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps
      samples.push([ax + (bx - ax) * t, az + (bz - az) * t])
    }
  }
  const last = path[path.length - 1]
  samples.push([last[0], last[1]])
  return samples
}

/** How far lanterns sit off the road centerline (outside dirt half-width). */
export const LANTERN_ROAD_SHOULDER = 1.65
/** Min spacing between pilgrim lanterns along / across branches. */
export const LANTERN_SPACING = 7.25
/**
 * Keep roadside lanterns off the stone span — Silverrun posts light the deck.
 * Expanded past the walk rectangle so poles don't plant in the channel apron.
 */
export const LANTERN_BRIDGE_CLEARANCE = 1.15
/** Extra dry-ground margin beyond the water edge (world units). */
export const LANTERN_WATER_CLEARANCE = 0.55

/** True when a lamp foot can stand here without reading as mid-channel. */
export function isDryLanternGround(x: number, z: number) {
  if (onSpanDeck(SILVERRUN_SPAN, x, z, LANTERN_BRIDGE_CLEARANCE)) return false
  const river = sampleRiver(x, z)
  return river.distance >= river.waterHalfWidth + LANTERN_WATER_CLEARANCE
}

/**
 * Place pilgrim / shrine-branch lanterns on dry road shoulders.
 * Samples snapped centerlines so crossings never drop poles into open water.
 */
export function buildPilgrimLanterns(
  paths: Array<Array<[number, number]>> = roadPaths.slice(0, 2),
): Array<[number, number]> {
  const placed: Array<[number, number]> = []

  const tooClose = (x: number, z: number) =>
    placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < LANTERN_SPACING)

  for (let pathIndex = 0; pathIndex < paths.length; pathIndex += 1) {
    const samples = sampleRoadCenterline(paths[pathIndex], 0.5)
    // Prefer the outside of the Y-junction: pilgrim south (+Z), shrine north (−Z).
    const preferredSide = pathIndex === 0 ? 1 : -1

    for (let i = 1; i < samples.length - 1; i += 1) {
      const [x, z] = samples[i]
      // Anchor must itself be dry so the road sample isn't mid-channel.
      if (!isDryLanternGround(x, z)) continue

      const [ax, az] = samples[i - 1]
      const [bx, bz] = samples[i + 1]
      const tx = bx - ax
      const tz = bz - az
      const len = Math.hypot(tx, tz)
      if (len < 1e-6) continue
      const nx = -tz / len
      const nz = tx / len

      let best: [number, number] | null = null
      for (const side of [preferredSide, -preferredSide]) {
        const lx = x + nx * side * LANTERN_ROAD_SHOULDER
        const lz = z + nz * side * LANTERN_ROAD_SHOULDER
        if (!isDryLanternGround(lx, lz)) continue
        if (tooClose(lx, lz)) continue
        best = [lx, lz]
        break
      }
      if (!best) continue
      placed.push(best)
    }
  }

  return placed
}

/** Roadside lanterns after Mara wakes the pilgrim road. */
export const pilgrimLanterns: Array<[number, number]> = buildPilgrimLanterns()

/**
 * How far shrine lamps sit past each abutment along the span axis.
 * Must clear LANTERN_BRIDGE_CLEARANCE so feet read as bank approach, not deck.
 */
export const BRIDGE_APPROACH_OUTWARD = 1.3

/**
 * Paired tōrō positions flanking both Silverrun approaches (before / after the span).
 */
export function buildBridgeApproachLanterns(
  span: BridgeSpan = SILVERRUN_SPAN,
): Array<[number, number]> {
  const [px, pz] = spanPerp(span)
  const placed: Array<[number, number]> = []

  for (const [ax, az] of spanAbutments(span)) {
    const dx = ax - span.x
    const dz = az - span.z
    const len = Math.hypot(dx, dz)
    const ox = len > 1e-6 ? dx / len : span.axisX
    const oz = len > 1e-6 ? dz / len : span.axisZ

    for (const side of [-1, 1] as const) {
      const x = ax + ox * BRIDGE_APPROACH_OUTWARD + px * side * LANTERN_ROAD_SHOULDER
      const z = az + oz * BRIDGE_APPROACH_OUTWARD + pz * side * LANTERN_ROAD_SHOULDER
      if (!isDryLanternGround(x, z)) continue
      placed.push([x, z])
    }
  }

  return placed
}

/** Always-on shrine lamps at Silverrun bank approaches. */
export const bridgeApproachLanterns: Array<[number, number]> = buildBridgeApproachLanterns()

export const scenery: SceneryPoint[] = []

function blocksClearing(x: number, z: number) {
  const river = sampleRiver(x, z)
  const villageDistance = Math.hypot(x + 9, z - 10)
  const bridgeDistance = Math.hypot(x - SILVERRUN_SPAN.x, z - SILVERRUN_SPAN.z)
  const shrineDistance = Math.hypot(x + 20, z + 16)
  const towerDistance = Math.hypot(x - 22, z + 22)
  const ascentDistance = Math.hypot(x - WHISPERING_ASCENT.landingX, z - WHISPERING_ASCENT.landingZ)
  const ascentTop = Math.hypot(x - WHISPERING_ASCENT.topX, z - WHISPERING_ASCENT.topZ)
  return (
    river.distance < river.bankHalfWidth + 0.7 ||
    villageDistance < 9 ||
    bridgeDistance < 6.5 ||
    shrineDistance < 5 ||
    towerDistance < 6 ||
    onAscentLane(x, z, 1.35) ||
    ascentDistance < 4.2 ||
    ascentTop < 5.5 ||
    onMistcliffSummit(x, z, 1.2) ||
    distanceToNearestRoad(x, z) < ROAD_SCENERY_CLEARANCE
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
  // Airier stands — keep trunks from forming impassable walls.
  if (nearTree(x, z, 2.1)) return
  scenery.push({
    x,
    z,
    scale: 0.72 + random() * 0.7,
    hue: random(),
    kind: random() < pineChance ? 'pine' : 'oak',
  })
}

/** Sparse forest pockets wrapping the vale — trees cluster toward each center. */
const forestClusters = [
  { x: 30, z: 9, count: 22, radius: 12.5, pineChance: 0.28 },
  { x: -31, z: -5, count: 20, radius: 11.5, pineChance: 0.35 },
  { x: 22, z: -15, count: 18, radius: 10.5, pineChance: 0.42 },
  { x: -25, z: 15, count: 16, radius: 9.5, pineChance: 0.22 },
  { x: 12, z: 17, count: 14, radius: 8.5, pineChance: 0.18 },
  { x: -16, z: -22, count: 15, radius: 9.5, pineChance: 0.48 },
  { x: 34, z: -18, count: 12, radius: 8.5, pineChance: 0.4 },
  { x: -35, z: 5, count: 12, radius: 8, pineChance: 0.3 },
  { x: 6, z: -24, count: 11, radius: 7.5, pineChance: 0.55 },
  { x: -8, z: 20, count: 10, radius: 7, pineChance: 0.2 },
  // Sparse pines framing the mist cliff (kept off the stair lane by blocksClearing).
  { x: -22, z: -24, count: 9, radius: 6.5, pineChance: 0.72 },
  { x: -8, z: -26, count: 8, radius: 5.5, pineChance: 0.65 },
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
for (let i = 0; i < 18; i += 1) {
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
for (let i = 0; i < 40; i += 1) {
  const x = (random() - 0.5) * 80
  const z = (random() - 0.5) * 56
  if (blocksClearing(x, z)) continue
  if (nearTree(x, z, 2.4)) continue
  const roll = random()
  scenery.push({
    x,
    z,
    scale: 0.7 + random() * 0.7,
    hue: random(),
    kind: roll < 0.62 ? 'rock' : 'flower',
  })
}

// Pale flowers on the Whispering Ascent mid-landing (reference: lavender meadow tread).
for (const [fx, fz] of [
  [-15.0, -23.6],
  [-15.5, -23.9],
  [-14.9, -24.1],
  [-15.7, -23.5],
  [-15.2, -24.3],
] as const) {
  scenery.push({ x: fx, z: fz, scale: 0.55 + random() * 0.25, hue: 0.72 + random() * 0.12, kind: 'flower' })
}

// Weathered stones flanking the stair mouth (kept clear of road discs).
for (const [rx, rz, s] of [
  [-8.6, -18.4, 0.95],
  [-13.9, -18.8, 0.82],
  [-17.1, -22.1, 1.05],
  [-12.8, -25.4, 0.9],
] as const) {
  if (distanceToNearestRoad(rx, rz) < ROAD_SCENERY_CLEARANCE) continue
  if (onAscentLane(rx, rz, 0.4)) continue
  scenery.push({ x: rx, z: rz, scale: s, hue: random(), kind: 'rock' })
}

/**
 * Silverrun bridge deck — shared by walkHeight and bridge FX gates.
 * Oriented procedural span from build/crossings (not a loose ellipse over the ford).
 */
export const SILVERRUN_BRIDGE = {
  x: SILVERRUN_SPAN.x,
  z: SILVERRUN_SPAN.z,
  /** Half-extents along / across the deck axis (compat with older ellipse callers). */
  radiusX: SILVERRUN_SPAN.halfLength,
  radiusZ: SILVERRUN_SPAN.halfWidth,
  deckY: SILVERRUN_SPAN.deckY,
  axisX: SILVERRUN_SPAN.axisX,
  axisZ: SILVERRUN_SPAN.axisZ,
} as const

/** True when the sample sits in the river channel (bridge deck excluded). */
export function inRiverChannel(x: number, z: number) {
  if (onBridgeDeck(x, z)) return false
  return sampleRiver(x, z).inWater
}

/**
 * Oriented deck membership for the Silverrun span.
 * `margin` expands (>0) or shrinks (<0) the rectangle in world units.
 */
export function onBridgeDeck(x: number, z: number, margin = 0) {
  return onSpanDeck(SILVERRUN_SPAN, x, z, margin)
}

/** 1 at deck center → 0 at span edge (and outside). */
export function bridgeDeckBlend(x: number, z: number) {
  return spanDeckBlend(SILVERRUN_SPAN, x, z)
}

function terrainHeightForAscent(x: number, z: number, ascent: AscentSample) {
  const broad = Math.sin(x * 0.085) * 0.52 + Math.cos(z * 0.11) * 0.42
  const rolling = Math.sin((x + z) * 0.13) * 0.25
  const towerRise = Math.exp(-((x - 22) ** 2 + (z + 22) ** 2) / 95) * 2.8
  const farDistance = Math.max(0, -z - 27)
  const farRise = farDistance * farDistance * 0.008
  // Compact mountain with a broad summit around the far castle.
  const mistMountain = mistcliffMountainRise(x, z)
  // Soft shoulder under the stair flight (keeps mesh from floating over a void).
  const mistShoulder = Math.exp(-((x + 14.5) ** 2 + (z + 23.5) ** 2) / 48) * 1.55
  // Localized abyss bowl east of the stair lane — fog reads deeper without carving the vale.
  const abyssDrop = Math.exp(-((x + 7.2) ** 2 + (z + 24.5) ** 2) / 36) * 2.55
  let base = broad + rolling + towerRise + farRise + mistMountain + mistShoulder - abyssDrop

  // Cut a shallow support channel through the mountain so procedural treads
  // remain visible instead of being swallowed where the upper flight enters it.
  const stairY = ascent.walkY
  const stairMask = ascent.blend
  if (stairY != null && stairMask > 0 && base > stairY - 0.04) {
    const t = stairMask * stairMask
    base += (stairY - 0.04 - base) * t
  }

  const river = sampleRiver(x, z)
  if (!river.inBank) return base

  if (river.inWater) {
    return Math.min(base, river.bedY)
  }

  const shoreT =
    (river.distance - river.waterHalfWidth) /
    Math.max(0.001, river.bankHalfWidth - river.waterHalfWidth)
  const smooth = shoreT * shoreT * (3 - 2 * shoreT)
  const shorelineY = WATER_SURFACE_Y + 0.035
  return shorelineY + (base - shorelineY) * smooth
}

export function terrainHeight(x: number, z: number) {
  return terrainHeightForAscent(x, z, sampleAscent(x, z))
}

/**
 * World-space root position for a landmark — Y comes from the height field,
 * never from an authored constant. See `grounding.ts` for the contact equation.
 */
export function landmarkWorldPosition(landmark: Landmark): [number, number, number] {
  const [x, z] = landmark.xz
  const y = groundedRootY({
    x,
    z,
    heightAt: terrainHeight,
    footLocalY: landmark.footLocalY,
    scale: landmark.scale,
    contactBias: landmark.contactBias,
    padRadius: landmark.padRadius ?? landmarkFootRadius(landmark),
    padMode: landmark.padMode,
  })
  return [x, y, z]
}

/**
 * Surface the party stands on — analytical terrain, Silverrun deck, Whispering Ascent.
 * Fording follows the carved river bowl (gradual walk down), not a lifted water plane.
 * Houses/buildings are solid XZ blockers (see collision.ts); they are not walk surfaces.
 */
export function walkHeight(x: number, z: number) {
  const ascent = sampleAscent(x, z)
  let y = terrainHeightForAscent(x, z, ascent)

  const bridge = bridgeDeckBlend(x, z)
  if (bridge > 0) {
    const t = bridge * bridge * (3 - 2 * bridge)
    y = y + (spanDeckHeight(SILVERRUN_SPAN, x, z) - y) * t
  }

  if (ascent.blend > 0) {
    const stairY = ascent.walkY
    if (stairY != null) {
      const t = ascent.blend * ascent.blend
      y = y + (stairY - y) * t
    }
  }

  return y
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
  if (!onBridgeDeck(x, z) && sampleRiver(x, z).isDeep) return false
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
