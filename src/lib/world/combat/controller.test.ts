import { describe, expect, it } from 'vitest'
import {
  AUTO_ATTACK,
  attackAnimationDuration,
  attackImpactTime,
  createAttackState,
  LEADER_ATTACK_LOADOUT,
  tickAttack,
  tryActivateSlot,
} from './index'
import { attackAnimationFor } from '../actors/attackAnimations'
import { frameIndex } from '../actors/spriteSheet'

describe('attack controller', () => {
  const loadout = [...LEADER_ATTACK_LOADOUT]
  const animation = attackAnimationFor('paladin', AUTO_ATTACK.id)!
  const duration = attackAnimationDuration(animation)

  it('fires at the character-authored impact frame and locks movement', () => {
    const state = createAttackState()
    const started = tryActivateSlot(state, loadout, 1, animation)
    expect(started?.id).toBe(AUTO_ATTACK.id)

    const mid = tickAttack(state, attackImpactTime(animation) - 0.001)
    expect(mid.active?.id).toBe(AUTO_ATTACK.id)
    expect(mid.movementLocked).toBe(true)
    expect(mid.hitJustFired).toBe(false)

    const hit = tickAttack(state, 0.002)
    expect(hit.hitJustFired).toBe(true)
    expect(
      frameIndex(
        state.active!.elapsed,
        animation.frameCount,
        hit.active!.motion,
      ),
    ).toBe(animation.impactFrame)

    const done = tickAttack(state, duration)
    expect(done.active).toBeNull()
    expect(done.movementLocked).toBe(false)
  })

  it('rejects reactivation while busy or on cooldown', () => {
    const state = createAttackState()
    expect(tryActivateSlot(state, loadout, 1, animation)).not.toBeNull()
    expect(tryActivateSlot(state, loadout, 1, animation)).toBeNull()

    tickAttack(state, duration + 0.01)
    expect(tryActivateSlot(state, loadout, 1, animation)).toBeNull()

    tickAttack(state, AUTO_ATTACK.cooldown)
    expect(tryActivateSlot(state, loadout, 1, animation)?.id).toBe(AUTO_ATTACK.id)
  })

  it('ignores unbound slots and modules without character animation data', () => {
    const state = createAttackState()
    expect(tryActivateSlot(state, loadout, 2, animation)).toBeNull()
    expect(tryActivateSlot(state, loadout, 1, undefined)).toBeNull()
  })
})
