import { get } from 'svelte/store'
import { beforeEach, describe, expect, it } from 'vitest'
import { FIXED_DT } from '../../battle/hexsim'
import { combatHud } from '../combat'
import {
  battleHud,
  battleVitals,
  enterBattle,
  getBattleActorOpacity,
  isEncounterCleared,
  isLootCollectable,
  isPartyReturning,
  notifyPartyReturnComplete,
  requestStartBattle,
  resetBattleBridge,
  shouldShowBattleUnitVitals,
  shouldRenderBattleUnits,
  shouldShowOverworldEnemyVitals,
  tickBattleBridge,
} from './battleBridge'

const STALE_ENEMY = {
  id: 'gargoyle-sentinel',
  name: 'Vale Gargoyle',
  health: 72,
  maxHealth: 72,
  alive: true,
  screenX: 0.4,
  screenY: 0.3,
  onScreen: true,
  focused: false,
}

describe('floating vitals ownership', () => {
  beforeEach(() => {
    resetBattleBridge()
  })

  it('allows overworld vitals only while exploring an uncleared pack', () => {
    expect(shouldShowOverworldEnemyVitals()).toBe(true)
    expect(shouldShowBattleUnitVitals()).toBe(false)
  })

  it('clears stale overworld vitals when battle starts', () => {
    combatHud.set({ enemies: [STALE_ENEMY], damage: [] })
    enterBattle()
    expect(shouldShowOverworldEnemyVitals()).toBe(false)
    expect(get(combatHud).enemies).toEqual([])
    expect(get(battleVitals)).toEqual([])
  })

  it('does not restore overworld vitals after a won encounter soft-exits', () => {
    combatHud.set({ enemies: [STALE_ENEMY], damage: [] })
    enterBattle()

    // Prelude → handoff → march-in.
    tickBattleBridge(0.6)
    expect(shouldShowBattleUnitVitals()).toBe(true)

    tickBattleBridge(4)
    requestStartBattle()

    let steps = 0
    while (get(battleHud).phase === 'fighting' && steps < 900) {
      tickBattleBridge(FIXED_DT)
      steps += 1
    }
    expect(get(battleHud).phase).toBe('victory')
    expect(get(battleHud).over).toBe(true)
    expect(isLootCollectable()).toBe(false)
    expect(shouldRenderBattleUnits()).toBe(true)
    expect(getBattleActorOpacity()).toBe(1)

    // Result hold transitions into a battle-card dissolve.
    tickBattleBridge(0.5)
    expect(getBattleActorOpacity()).toBeGreaterThan(0)
    expect(getBattleActorOpacity()).toBeLessThan(1)
    tickBattleBridge(0.6)
    expect(shouldRenderBattleUnits()).toBe(false)

    // Stage fades, then world heroes own the final formation but are still dropping in.
    tickBattleBridge(0.8)

    expect(get(battleHud).phase).toBe('idle')
    expect(isEncounterCleared()).toBe(true)
    expect(isPartyReturning()).toBe(true)
    expect(isLootCollectable()).toBe(false)
    expect(get(battleHud).packCleared).toBe(true)
    expect(shouldShowOverworldEnemyVitals()).toBe(false)
    expect(shouldShowBattleUnitVitals()).toBe(false)
    expect(get(combatHud).enemies).toEqual([])
    expect(get(battleVitals)).toEqual([])

    notifyPartyReturnComplete()
    expect(isPartyReturning()).toBe(false)
    expect(isLootCollectable()).toBe(true)
  })
})
