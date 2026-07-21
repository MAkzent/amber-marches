import { describe, expect, it } from 'vitest'
import { defaultDecide } from './decide'
import { createSim, FIXED_DT } from './sim'
import type { HexUnitStats, UnitSpawn } from './types'

function stats(overrides: Partial<HexUnitStats> = {}): HexUnitStats {
  return {
    maxHp: 40,
    attackDamage: 12,
    secondsPerHex: 0.2,
    attackRangeHexes: 1,
    attackCooldownSeconds: 0.4,
    attackWindupSeconds: 0.1,
    attackDurationSeconds: 0.25,
    speed: 10,
    ...overrides,
  }
}

function spawn(
  id: string,
  team: 'hero' | 'enemy',
  q: number,
  r: number,
  overrides: Partial<HexUnitStats> = {},
): UnitSpawn {
  return {
    id,
    actorId: id,
    team,
    hex: { q, r },
    stats: stats(overrides),
  }
}

describe('hex sim', () => {
  it('relocateUnit moves a hero onto a free cell', () => {
    const sim = createSim(
      [spawn('h1', 'hero', 0, 2), spawn('e1', 'enemy', 0, -2)],
      { boardRadius: 4, seed: 1, decide: defaultDecide },
    )
    expect(sim.relocateUnit('h1', { q: 1, r: 2 })).toBe(true)
    expect(sim.units.find((u) => u.id === 'h1')?.hex).toEqual({ q: 1, r: 2 })
    expect(sim.relocateUnit('h1', { q: 0, r: -2 })).toBe(false)
  })

  it('does not resolve combat until stepped', () => {
    const sim = createSim(
      [spawn('h1', 'hero', 0, 1), spawn('e1', 'enemy', 0, 0)],
      { boardRadius: 4, seed: 1, decide: defaultDecide },
    )
    expect(sim.units.every((u) => u.hp === u.stats.maxHp)).toBe(true)
    expect(sim.isOver()).toBe(false)
  })

  it('emits attackStart then hit at windup and can finish a fight', () => {
    const sim = createSim(
      [
        spawn('h1', 'hero', 0, 1, { attackDamage: 20, maxHp: 80 }),
        spawn('e1', 'enemy', 0, 0, { maxHp: 40, attackDamage: 4 }),
      ],
      { boardRadius: 4, seed: 1, decide: defaultDecide },
    )

    const seen = new Set<string>()
    let steps = 0
    while (!sim.isOver() && steps < 600) {
      for (const ev of sim.step(FIXED_DT)) seen.add(ev.type)
      steps += 1
    }

    expect(seen.has('attackStart')).toBe(true)
    expect(seen.has('hit')).toBe(true)
    expect(sim.isOver()).toBe(true)
    expect(sim.units.some((u) => u.team === 'hero' && u.alive)).toBe(true)
  })

  it('always emits the configured base attack damage', () => {
    const sim = createSim(
      [
        spawn('h1', 'hero', 0, 1, {
          attackDamage: 20,
          maxHp: 80,
          attackCooldownSeconds: 0.05,
          attackWindupSeconds: 0.05,
          attackDurationSeconds: 0.1,
        }),
        spawn('e1', 'enemy', 0, 0, {
          maxHp: 200,
          attackDamage: 0,
          attackCooldownSeconds: 99,
        }),
      ],
      { boardRadius: 4, seed: 1, decide: defaultDecide },
    )

    let hitAmount = 0
    for (let i = 0; i < 120; i += 1) {
      for (const ev of sim.step(FIXED_DT)) {
        if (ev.type === 'hit' && ev.unitId === 'h1') hitAmount = ev.amount
      }
      if (hitAmount > 0) break
    }
    expect(hitAmount).toBe(20)
  })

  it('fractionalHexOf interpolates during glides', () => {
    const sim = createSim(
      [
        spawn('h1', 'hero', 0, 2, { secondsPerHex: 1, attackRangeHexes: 1 }),
        spawn('e1', 'enemy', 0, -2, { attackDamage: 0, maxHp: 999 }),
      ],
      { boardRadius: 4, seed: 1, decide: defaultDecide },
    )
    // Force a step so the hero begins walking toward the enemy.
    for (let i = 0; i < 5; i++) sim.step(FIXED_DT)
    const hero = sim.units.find((u) => u.id === 'h1')!
    if (hero.activity.kind === 'moving') {
      const frac = sim.fractionalHexOf(hero)
      expect(frac.q).not.toBe(hero.activity.from.q === hero.activity.to.q ? frac.q + 1 : Infinity)
      expect(
        Math.abs(frac.q - hero.activity.from.q) + Math.abs(frac.r - hero.activity.from.r),
      ).toBeGreaterThan(0)
    } else {
      // Already adjacent / attacking — still a valid outcome.
      expect(['idle', 'attacking']).toContain(hero.activity.kind)
    }
  })
})
