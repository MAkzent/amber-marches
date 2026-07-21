import {
  hexesWithin,
  hexKey,
  hexNeighbors,
  hexToWorldXZ,
  WORLD_HEX_SIZE,
  type BoardOrigin,
  type Hex,
} from '../../battle'
import { isFree } from '../collision'

/** Disc used when probing whether a hex centre / fringe is standable. */
const PROBE_RADIUS = 0.42

/**
 * Hexes whose centres (and most of a mid-ring sample) are not free —
 * deep water, solid props, collision discs. Omitted from the drawn board
 * and from deploy / pathing via the sim `blocked` list.
 */
export function computeBlockedHexes(
  origin: BoardOrigin,
  boardRadius: number,
  hexSize = WORLD_HEX_SIZE,
): Hex[] {
  const blocked: Hex[] = []
  for (const hex of hexesWithin({ q: 0, r: 0 }, boardRadius)) {
    if (!hexIsTraversable(hex, origin, hexSize)) {
      blocked.push({ ...hex })
    }
  }
  return blockDisconnectedHexes(blocked, boardRadius)
}

/**
 * Keep one contiguous tactical field. World collision can otherwise leave
 * visually open islands that units can spawn on but never reach.
 */
export function blockDisconnectedHexes(blocked: readonly Hex[], boardRadius: number): Hex[] {
  const all = hexesWithin({ q: 0, r: 0 }, boardRadius)
  const blockedKeys = new Set(blocked.map((hex) => hexKey(hex)))
  const openKeys = new Set(
    all.filter((hex) => !blockedKeys.has(hexKey(hex))).map((hex) => hexKey(hex)),
  )
  const visited = new Set<string>()
  let largest = new Set<string>()

  for (const start of all) {
    const startKey = hexKey(start)
    if (!openKeys.has(startKey) || visited.has(startKey)) continue
    const component = new Set<string>()
    const queue = [start]
    visited.add(startKey)
    while (queue.length) {
      const current = queue.shift()!
      const currentKey = hexKey(current)
      component.add(currentKey)
      for (const next of hexNeighbors(current)) {
        const key = hexKey(next)
        if (!openKeys.has(key) || visited.has(key)) continue
        visited.add(key)
        queue.push(next)
      }
    }
    if (component.size > largest.size) largest = component
  }

  return all
    .filter((hex) => blockedKeys.has(hexKey(hex)) || !largest.has(hexKey(hex)))
    .map((hex) => ({ ...hex }))
}

export function hexIsTraversable(
  hex: Hex,
  origin: BoardOrigin,
  hexSize = WORLD_HEX_SIZE,
): boolean {
  const center = hexToWorldXZ(hex, origin, hexSize)
  if (!isFree(center.x, center.z, PROBE_RADIUS)) return false

  const yaw = origin.yaw ?? 0
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const ring = hexSize * 0.5
  let ok = 0
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    const lx = Math.cos(angle) * ring
    const lz = Math.sin(angle) * ring
    const x = center.x + lx * cos - lz * sin
    const z = center.z + lx * sin + lz * cos
    if (isFree(x, z, PROBE_RADIUS * 0.85)) ok += 1
  }
  // Allow a little shore friction; reject mostly-wet / mostly-blocked cells.
  return ok >= 4
}

export function blockedKeySet(blocked: Hex[]): Set<string> {
  return new Set(blocked.map((h) => hexKey(h)))
}
