import { describe, expect, it } from 'vitest'
import {
  BOARD_RADIUS,
  WORLD_HEX_SIZE,
  hexesWithin,
  hexToWorldXZ,
} from '../../battle'
import {
  blockDisconnectedHexes,
  computeBlockedHexes,
  hexIsTraversable,
} from './boardTerrain'
import { ENCOUNTER_ORIGIN } from './battleBridge'
import { isFree } from '../collision'

describe('battle board terrain', () => {
  const origin = { ...ENCOUNTER_ORIGIN, yaw: 0 }

  it('marks deep-water / blocked probes as non-traversable near the river', () => {
    const blocked = computeBlockedHexes(origin, BOARD_RADIUS, WORLD_HEX_SIZE)
    expect(blocked.length).toBeGreaterThan(0)

    for (const hex of blocked) {
      expect(hexIsTraversable(hex, origin, WORLD_HEX_SIZE)).toBe(false)
    }
  })

  it('keeps dry grass cells open when the probe is free', () => {
    const blocked = computeBlockedHexes(origin, BOARD_RADIUS, WORLD_HEX_SIZE)
    const blockedKeys = new Set(blocked.map((h) => `${h.q},${h.r}`))
    // Board centre sits on the pack clearing — should remain walkable.
    expect(blockedKeys.has('0,0')).toBe(false)
    const center = hexToWorldXZ({ q: 0, r: 0 }, origin, WORLD_HEX_SIZE)
    expect(isFree(center.x, center.z, 0.42)).toBe(true)
  })

  it('folds disconnected open islands into the blocked set', () => {
    const radius = 2
    const keptOpen = new Set(['0,0', '0,1', '-2,2'])
    const almostAll = hexesWithin({ q: 0, r: 0 }, radius).filter(
      (hex) => !keptOpen.has(`${hex.q},${hex.r}`),
    )
    const blocked = blockDisconnectedHexes(almostAll, radius)
    const keys = new Set(blocked.map((hex) => `${hex.q},${hex.r}`))
    expect(keys.has('0,0')).toBe(false)
    expect(keys.has('-2,2')).toBe(true)
  })
})
