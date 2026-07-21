import { hexToWorld, worldToHex, type Hex } from './hexsim'
import { BATTLE_HEX_SIZE } from './battleMap'

/** World-space hex size (centre-to-corner) in meters. */
export const WORLD_HEX_SIZE = BATTLE_HEX_SIZE

export type BoardOrigin = {
  x: number
  z: number
  /** Radians yaw of the +q axis relative to world +X (default 0). */
  yaw?: number
}

/**
 * Axial hex → world XZ. Local board y maps to world z (pointy-top flat on ground).
 */
export function hexToWorldXZ(hex: Hex, origin: BoardOrigin, size = WORLD_HEX_SIZE): {
  x: number
  z: number
} {
  const local = hexToWorld(hex, size)
  const yaw = origin.yaw ?? 0
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const lx = local.x
  const lz = local.y
  return {
    x: origin.x + lx * cos - lz * sin,
    z: origin.z + lx * sin + lz * cos,
  }
}

export function worldXZToHex(
  x: number,
  z: number,
  origin: BoardOrigin,
  size = WORLD_HEX_SIZE,
): Hex {
  const yaw = origin.yaw ?? 0
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const dx = x - origin.x
  const dz = z - origin.z
  const localX = dx * cos + dz * sin
  const localY = -dx * sin + dz * cos
  return worldToHex(localX, localY, size)
}

export function fractionalHexToWorldXZ(
  q: number,
  r: number,
  origin: BoardOrigin,
  size = WORLD_HEX_SIZE,
): { x: number; z: number } {
  return hexToWorldXZ({ q, r }, origin, size)
}
