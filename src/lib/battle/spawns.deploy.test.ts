import { describe, expect, it } from 'vitest'
import {
  HERO_DEPLOY_HEXES,
  buildDefaultSpawns,
  openDeployCells,
  resolveDeploySlots,
} from './spawns'
import { hexKey } from './hexsim'

describe('deploy slot resolution', () => {
  it('filters preferred deploy cells that are blocked', () => {
    const blocked = [HERO_DEPLOY_HEXES[0], HERO_DEPLOY_HEXES[1]]
    const open = openDeployCells(HERO_DEPLOY_HEXES, blocked)
    expect(open).toHaveLength(HERO_DEPLOY_HEXES.length - 2)
    expect(open.some((h) => hexKey(h) === hexKey(blocked[0]))).toBe(false)
  })

  it('falls back to nearby same-side cells when preferred deploy is flooded', () => {
    const slots = resolveDeploySlots(HERO_DEPLOY_HEXES, 4, 'hero', HERO_DEPLOY_HEXES, 5)
    expect(slots).toHaveLength(4)
    for (const hex of slots) {
      expect(hex.q).toBeLessThan(0)
      expect(HERO_DEPLOY_HEXES.some((h) => h.q === hex.q && h.r === hex.r)).toBe(false)
    }
  })

  it('builds spawns that never land on blocked preferred cells', () => {
    const blocked = [...HERO_DEPLOY_HEXES]
    const spawns = buildDefaultSpawns({ blocked, boardRadius: 5 })
    const heroes = spawns.filter((s) => s.team === 'hero')
    expect(heroes).toHaveLength(4)
    for (const spawn of heroes) {
      expect(blocked.some((h) => h.q === spawn.hex.q && h.r === spawn.hex.r)).toBe(false)
    }
  })
})
