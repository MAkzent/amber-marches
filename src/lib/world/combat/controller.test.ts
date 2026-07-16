import { describe, expect, it } from 'vitest'
import {
  AUTO_ATTACK,
  createAttackState,
  LEADER_ATTACK_LOADOUT,
  tickAttack,
  tryActivateSlot,
} from './index'

describe('attack controller', () => {
  const loadout = [...LEADER_ATTACK_LOADOUT]

  it('fires slot 1 auto-attack and locks movement until duration ends', () => {
    const state = createAttackState()
    const started = tryActivateSlot(state, loadout, 1)
    expect(started?.id).toBe(AUTO_ATTACK.id)

    const mid = tickAttack(state, AUTO_ATTACK.duration * 0.2)
    expect(mid.active?.id).toBe(AUTO_ATTACK.id)
    expect(mid.movementLocked).toBe(true)
    expect(mid.hitJustFired).toBe(false)

    const hit = tickAttack(state, AUTO_ATTACK.duration * AUTO_ATTACK.hitAt)
    expect(hit.hitJustFired).toBe(true)

    const done = tickAttack(state, AUTO_ATTACK.duration)
    expect(done.active).toBeNull()
    expect(done.movementLocked).toBe(false)
  })

  it('rejects reactivation while busy or on cooldown', () => {
    const state = createAttackState()
    expect(tryActivateSlot(state, loadout, 1)).not.toBeNull()
    expect(tryActivateSlot(state, loadout, 1)).toBeNull()

    tickAttack(state, AUTO_ATTACK.duration + 0.01)
    expect(tryActivateSlot(state, loadout, 1)).toBeNull()

    tickAttack(state, AUTO_ATTACK.cooldown)
    expect(tryActivateSlot(state, loadout, 1)?.id).toBe(AUTO_ATTACK.id)
  })

  it('ignores unbound slots', () => {
    const state = createAttackState()
    expect(tryActivateSlot(state, loadout, 2)).toBeNull()
  })
})
