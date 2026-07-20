import { afterEach, describe, expect, it } from 'vitest'
import {
  clearAttackSwings,
  getAttackSwings,
  pushAttackSwing,
  tickAttackSwings,
} from './attackEvents'

afterEach(clearAttackSwings)

describe('attack swing events', () => {
  it('assigns unique ids and ages old events out', () => {
    const first = pushAttackSwing('paladin', 'auto-attack', 0, 0, 'front-right')
    const second = pushAttackSwing('paladin', 'auto-attack', 0, 0, 'front-left')

    expect(second.id).toBeGreaterThan(first.id)
    expect(getAttackSwings()).toHaveLength(2)

    tickAttackSwings(0.36)
    expect(getAttackSwings()).toEqual([])
  })
})
