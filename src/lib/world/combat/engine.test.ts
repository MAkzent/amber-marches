import { describe, expect, it } from 'vitest'
import { AUTO_ATTACK } from './modules'
import {
  createSwingResolver,
  findFocusTarget,
  isInsideMeleeArc,
  resolveSwing,
} from './engine'
import type { AttackSwingEvent, Combatant } from './types'

function swing(overrides: Partial<AttackSwingEvent> = {}): AttackSwingEvent {
  return {
    id: 1,
    attackerId: 'paladin',
    moduleId: AUTO_ATTACK.id,
    x: 0,
    z: 0,
    facing: 'front-right',
    age: 0,
    ...overrides,
  }
}

function enemy(id: string, x: number, z: number, health = 48): Combatant {
  return {
    id,
    faction: 'enemy',
    x,
    z,
    radius: 0.6,
    health,
    maxHealth: health,
    alive: true,
  }
}

describe('combat resolver', () => {
  it('accepts targets in the forward arc and rejects targets behind it', () => {
    expect(
      isInsideMeleeArc(swing(), AUTO_ATTACK.delivery, enemy('front', 1.2, 1.2)),
    ).toBe(true)
    expect(
      isInsideMeleeArc(swing(), AUTO_ATTACK.delivery, enemy('behind', -1.2, -1.2)),
    ).toBe(false)
  })

  it('cleaves every hostile target in range', () => {
    const combatants = [
      enemy('left', 0.35, 1.4),
      enemy('middle', 1.1, 1.1),
      enemy('right', 1.45, 0.25),
      enemy('far', 4, 4),
    ]
    let eventId = 0
    const events = resolveSwing(swing(), combatants, () => ++eventId)

    expect(events.map((event) => event.targetId)).toEqual(['left', 'middle', 'right'])
    expect(combatants.slice(0, 3).map((target) => target.health)).toEqual([24, 24, 24])
    expect(combatants[3].health).toBe(48)
  })

  it('locks a focused attack to one in-range target regardless of facing', () => {
    const behind = enemy('behind', -1.2, -1.2)
    const inFront = enemy('front', 1.2, 1.2)
    const events = resolveSwing(
      swing({ targetId: behind.id }),
      [behind, inFront],
      () => 1,
    )

    expect(events.map((event) => event.targetId)).toEqual(['behind'])
    expect(behind.health).toBe(24)
    expect(inFront.health).toBe(48)
  })

  it('keeps a valid focus target instead of flickering to a nearer enemy', () => {
    const current = enemy('current', 1.4, 1.4)
    const nearer = enemy('nearer', 0.8, 0.8)

    expect(
      findFocusTarget(0, 0, 'party', [current, nearer], 2.35, current.id)?.id,
    ).toBe(current.id)
    current.alive = false
    expect(
      findFocusTarget(0, 0, 'party', [current, nearer], 2.35, current.id)?.id,
    ).toBe(nearer.id)
  })

  it('filters friendlies and defeated targets', () => {
    const friendly = enemy('friendly', 1, 1)
    friendly.faction = 'party'
    const defeated = enemy('defeated', 1.2, 1.2)
    defeated.alive = false
    defeated.health = 0

    expect(resolveSwing(swing(), [friendly, defeated], () => 1)).toEqual([])
  })

  it('clamps lethal damage and resolves each swing only once', () => {
    const target = enemy('target', 1, 1, 12)
    const resolver = createSwingResolver()
    let eventId = 0
    const first = resolver.resolve(swing(), [target], () => ++eventId)
    const duplicate = resolver.resolve(swing(), [target], () => ++eventId)

    expect(first).toMatchObject([
      { amount: 12, remainingHealth: 0, defeated: true },
    ])
    expect(target.alive).toBe(false)
    expect(duplicate).toEqual([])
  })
})
