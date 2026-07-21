import {
  BOARD_RADIUS,
  WORLD_HEX_SIZE,
  hexToWorldXZ,
  hexesWithin,
  type BoardOrigin,
} from '../../battle'
import { LOOK_HEIGHT, OFFSET_X, OFFSET_Z } from './exploreRig'
import type { BattleTuning } from './battleTuning'

export type Vec3 = { x: number; y: number; z: number }

export type BoardExtents = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /** Fit samples: AABB corners + edge midpoints (margin applied). */
  points: { x: number; z: number }[]
}

export type BattleFrame = {
  focus: Vec3
  look: Vec3
  pos: Vec3
  distance: number
  fov: number
}

export type BattleSurfaceCell = {
  hex: { q: number; r: number }
  y: number
}

/** World-XZ AABB of exact hex corners, expanded by `margin`. */
export function boardExtentsXZ(
  origin: BoardOrigin,
  radius = BOARD_RADIUS,
  hexSize = WORLD_HEX_SIZE,
  margin = 0,
): BoardExtents {
  const hexes = hexesWithin({ q: 0, r: 0 }, radius)
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const hex of hexes) {
    const p = hexToWorldXZ(hex, origin, hexSize)
    for (let corner = 0; corner < 6; corner += 1) {
      const angle = (Math.PI / 180) * (60 * corner - 30) + (origin.yaw ?? 0)
      const x = p.x + Math.cos(angle) * hexSize
      const z = p.z + Math.sin(angle) * hexSize
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
  }
  minX -= margin
  maxX += margin
  minZ -= margin
  maxZ += margin
  const midX = (minX + maxX) * 0.5
  const midZ = (minZ + maxZ) * 0.5
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    points: [
      { x: minX, z: minZ },
      { x: minX, z: maxZ },
      { x: maxX, z: minZ },
      { x: maxX, z: maxZ },
      { x: midX, z: minZ },
      { x: midX, z: maxZ },
      { x: minX, z: midZ },
      { x: maxX, z: midZ },
    ],
  }
}

function yawOffset(yawRad: number): { ox: number; oz: number } {
  const cos = Math.cos(yawRad)
  const sin = Math.sin(yawRad)
  return {
    ox: OFFSET_X * cos - OFFSET_Z * sin,
    oz: OFFSET_X * sin + OFFSET_Z * cos,
  }
}

/** Pitch camera around look (same convention as WorldCamera / converse). */
export function applyPitchAroundLook(pos: Vec3, look: Vec3, pitchRad: number): Vec3 {
  if (Math.abs(pitchRad) < 1e-6) return { ...pos }
  const flatDist = Math.hypot(pos.x - look.x, pos.z - look.z)
  return {
    x: pos.x,
    y: look.y + Math.sin(pitchRad) * flatDist + (pos.y - look.y) * Math.cos(pitchRad),
    z: pos.z,
  }
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/**
 * Project world point into NDC (−1..1) for a perspective camera looking at `look`.
 * Returns null if the point is at/behind the camera.
 */
export function projectToNdc(
  point: Vec3,
  pos: Vec3,
  look: Vec3,
  fovDeg: number,
  aspect: number,
): { x: number; y: number } | null {
  const forward = normalize({
    x: look.x - pos.x,
    y: look.y - pos.y,
    z: look.z - pos.z,
  })
  const worldUp = { x: 0, y: 1, z: 0 }
  let right = cross(forward, worldUp)
  const rightLen = Math.hypot(right.x, right.y, right.z)
  if (rightLen < 1e-6) {
    right = { x: 1, y: 0, z: 0 }
  } else {
    right = { x: right.x / rightLen, y: right.y / rightLen, z: right.z / rightLen }
  }
  const up = cross(right, forward)

  const rel = { x: point.x - pos.x, y: point.y - pos.y, z: point.z - pos.z }
  const depth = dot(rel, forward)
  if (depth <= 1e-4) return null

  const x = dot(rel, right)
  const y = dot(rel, up)
  const vFov = (fovDeg * Math.PI) / 180
  const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * aspect)
  return {
    x: x / (depth * Math.tan(hFov * 0.5)),
    y: y / (depth * Math.tan(vFov * 0.5)),
  }
}

export function battlePerchAtDistance(
  focus: Vec3,
  distance: number,
  tuning: BattleTuning,
  aspect = 16 / 9,
): { pos: Vec3; look: Vec3 } {
  const yaw = (tuning.yawDeg * Math.PI) / 180
  const offset = yawOffset(yaw)
  const offsetLength = Math.hypot(offset.ox, offset.oz) || 1
  const elevation = (tuning.elevationDeg * Math.PI) / 180
  const horizontalDistance = distance * Math.cos(elevation)
  const height = distance * Math.sin(elevation)
  const ox = (offset.ox / offsetLength) * horizontalDistance
  const oz = (offset.oz / offsetLength) * horizontalDistance
  // Aim at board centre (not explore's ahead-of-party look offset).
  let look: Vec3 = {
    x: focus.x,
    y: focus.y + LOOK_HEIGHT + tuning.lookLift,
    z: focus.z,
  }
  let pos: Vec3 = {
    x: focus.x + ox,
    y: focus.y + height,
    z: focus.z + oz,
  }

  // NDC bias — shift look (and perch with it) like converse cluster framing.
  if (tuning.focusNdcX !== 0 || tuning.focusNdcY !== 0) {
    const toCluster = Math.hypot(pos.x - look.x, pos.z - look.z)
    const vFov = (tuning.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * aspect)
    const forwardFlatX = look.x - pos.x
    const forwardFlatZ = look.z - pos.z
    const flatLen = Math.hypot(forwardFlatX, forwardFlatZ) || 1
    const fx = forwardFlatX / flatLen
    const fz = forwardFlatZ / flatLen
    const rx = -fz
    const rz = fx
    const lookShiftX = toCluster * -tuning.focusNdcX * Math.tan(hFov * 0.5)
    // Positive focusNdcY places the board higher in frame.
    const lookShiftY = toCluster * -tuning.focusNdcY * Math.tan(vFov * 0.5)
    look = {
      x: look.x + rx * lookShiftX,
      y: look.y + lookShiftY,
      z: look.z + rz * lookShiftX,
    }
    pos = {
      x: focus.x + ox + rx * lookShiftX,
      y: focus.y + height,
      z: focus.z + oz + rz * lookShiftX,
    }
  }

  return { pos, look }
}

function pointsFit(
  points: Vec3[],
  pos: Vec3,
  look: Vec3,
  fov: number,
  aspect: number,
  padX: number,
  padY: number,
): boolean {
  const limitX = Math.max(0.2, 1 - padX)
  const limitY = Math.max(0.2, 1 - padY)
  for (const p of points) {
    const ndc = projectToNdc(p, pos, look, fov, aspect)
    if (!ndc) return false
    if (Math.abs(ndc.x) > limitX || Math.abs(ndc.y) > limitY) return false
  }
  return true
}

/**
 * Solve a board-fit cinematic perch: same SE isometric family as explore,
 * with converse-like pitch and a distance that keeps the hex disk inside
 * the padded frustum.
 */
export function resolveBattleFrame(options: {
  origin: BoardOrigin
  groundY: number
  tuning: BattleTuning
  aspect: number
  radius?: number
  hexSize?: number
  surfaceCells?: readonly BattleSurfaceCell[]
  unitHeadroom?: number
  unitPoints?: readonly Vec3[]
  focusXZ?: { x: number; z: number }
}): BattleFrame {
  const { origin, groundY, tuning, aspect } = options
  const radius = options.radius ?? BOARD_RADIUS
  const hexSize = options.hexSize ?? WORLD_HEX_SIZE
  const extents = boardExtentsXZ(origin, radius, hexSize, tuning.boardMargin)
  const focus: Vec3 = {
    x: options.focusXZ?.x ?? origin.x,
    y: groundY,
    z: options.focusXZ?.z ?? origin.z,
  }
  const fitPoints: Vec3[] = []
  if (options.surfaceCells?.length) {
    for (const cell of options.surfaceCells) {
      const center = hexToWorldXZ(cell.hex, origin, hexSize)
      for (let corner = 0; corner < 6; corner += 1) {
        const angle = (Math.PI / 180) * (60 * corner - 30) + (origin.yaw ?? 0)
        fitPoints.push({
          x: center.x + Math.cos(angle) * (hexSize + tuning.boardMargin),
          y: cell.y,
          z: center.z + Math.sin(angle) * (hexSize + tuning.boardMargin),
        })
      }
    }
    if (options.unitPoints?.length) {
      fitPoints.push(...options.unitPoints)
    } else if ((options.unitHeadroom ?? 0) > 0) {
      const headroom = options.unitHeadroom ?? 0
      for (const cell of options.surfaceCells) {
        const center = hexToWorldXZ(cell.hex, origin, hexSize)
        fitPoints.push({ x: center.x, y: cell.y + headroom, z: center.z })
      }
    }
  } else {
    for (const point of extents.points) {
      fitPoints.push({ ...point, y: groundY })
    }
  }

  let lo = tuning.distanceMin
  let hi = tuning.distanceMax
  let best = hi

  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5
    const { pos, look } = battlePerchAtDistance(focus, mid, tuning, aspect)
    if (pointsFit(fitPoints, pos, look, tuning.fov, aspect, tuning.padX, tuning.padY)) {
      best = mid
      hi = mid
    } else {
      lo = mid
    }
  }

  const distance = Math.min(tuning.distanceMax, Math.max(tuning.distanceMin, best))
  const { pos, look } = battlePerchAtDistance(focus, distance, tuning, aspect)
  return { focus, look, pos, distance, fov: tuning.fov }
}
