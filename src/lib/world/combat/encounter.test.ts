import { describe, expect, it } from 'vitest'
import { isFree } from '../collision'
import { PASSIVE_ENEMIES } from './encounter'

describe('passive combat encounter', () => {
  it('authors each enemy on free terrain without overlapping another enemy', () => {
    for (const enemy of PASSIVE_ENEMIES) {
      expect(isFree(enemy.x, enemy.z, enemy.radius), enemy.id).toBe(true)
    }

    for (let left = 0; left < PASSIVE_ENEMIES.length; left += 1) {
      for (let right = left + 1; right < PASSIVE_ENEMIES.length; right += 1) {
        const a = PASSIVE_ENEMIES[left]
        const b = PASSIVE_ENEMIES[right]
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(
          a.radius + b.radius,
        )
      }
    }
  })
})
