import { describe, expect, it } from 'vitest'
import {
  findHexPath,
  hexDistance,
  hexEq,
  hexKey,
  hexNeighbors,
  hexToWorld,
  worldToHex,
} from './hex'

describe('hex math', () => {
  it('computes axial distance', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1)
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2)
  })

  it('lists six neighbors', () => {
    expect(hexNeighbors({ q: 0, r: 0 })).toHaveLength(6)
  })

  it('round-trips world layout', () => {
    const size = 1.2
    const h = { q: 2, r: -1 }
    const w = hexToWorld(h, size)
    expect(hexEq(worldToHex(w.x, w.y, size), h)).toBe(true)
  })

  it('paths around a blocked cell', () => {
    const blocked = new Set([hexKey({ q: 1, r: 0 })])
    const path = findHexPath(
      { q: 0, r: 0 },
      { q: 2, r: 0 },
      (h) => blocked.has(hexKey(h)),
      4,
    )
    expect(path[0]).toEqual({ q: 0, r: 0 })
    expect(path.at(-1)).toEqual({ q: 2, r: 0 })
    expect(path.some((h) => hexKey(h) === '1,0')).toBe(false)
  })
})
