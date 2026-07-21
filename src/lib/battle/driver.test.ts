import { describe, expect, it } from 'vitest'
import { HexBattleDriver } from './driver'
import { FIXED_DT } from './hexsim'

describe('HexBattleDriver', () => {
  it('starts in placing and does not step until running', () => {
    const driver = new HexBattleDriver()
    driver.buildEncounter({ origin: { x: 6, z: 17 } })
    expect(driver.isPlacing()).toBe(true)
    const hpBefore = driver.mirrorSnapshot().map((u) => u.hp)
    driver.advance(1)
    expect(driver.mirrorSnapshot().map((u) => u.hp)).toEqual(hpBefore)
  })

  it('mirrors authored display names for units', () => {
    const driver = new HexBattleDriver()
    driver.buildEncounter({ origin: { x: 0, z: 0 } })
    const snap = driver.mirrorSnapshot()
    expect(snap.find((u) => u.id === 'hero-paladin')?.name).toBe('Paladin')
    expect(snap.find((u) => u.id === 'gargoyle-sentinel')?.name).toBe('Vale Gargoyle')
  })

  it('allows hero relocates only on deploy cells', () => {
    const driver = new HexBattleDriver()
    driver.buildEncounter({ origin: { x: 0, z: 0 } })
    const hero = driver.mirrorSnapshot().find((u) => u.team === 'hero')!
    expect(driver.moveUnit(hero.id, { q: -2, r: 0 })).toBe(true)
    expect(driver.moveUnit(hero.id, { q: 3, r: 0 })).toBe(false)
  })

  it('previews the same nearest opening target used by the sim', () => {
    const driver = new HexBattleDriver()
    driver.buildEncounter({ origin: { x: 0, z: 0 } })
    expect(
      driver.previewOpeningTarget('hero-paladin', { q: -2, r: 1 }),
    ).toBe('silverrun-rat')
  })

  it('omits blocked terrain from deploy and refuses placement there', () => {
    const driver = new HexBattleDriver()
    driver.buildEncounter({
      origin: { x: 0, z: 0 },
      blocked: [{ q: -2, r: 0 }, { q: -3, r: 0 }],
    })
    expect(driver.getBlockedCells()).toHaveLength(2)
    expect(driver.isHeroDeployHex({ q: -2, r: 0 })).toBe(false)
    expect(driver.isHeroDeployHex({ q: -2, r: 1 })).toBe(true)
    const hero = driver.mirrorSnapshot().find((u) => u.team === 'hero')!
    expect(driver.moveUnit(hero.id, { q: -2, r: 0 })).toBe(false)
  })

  it('reaches victory after setRunning', () => {
    const driver = new HexBattleDriver()
    const events: string[] = []
    driver.configure((evs) => {
      for (const e of evs) events.push(e.type)
    })
    driver.buildEncounter({ origin: { x: 0, z: 0 }, seed: 42 })
    driver.setRunning(true)
    let steps = 0
    while (driver.getState().phase === 'fighting' && steps < 900) {
      driver.advance(FIXED_DT)
      steps += 1
    }
    expect(driver.getState().phase).toBe('victory')
    expect(events).toContain('attackStart')
    expect(events).toContain('hit')
    expect(driver.defeatedEnemyPositions().length).toBeGreaterThan(0)
  })
})
