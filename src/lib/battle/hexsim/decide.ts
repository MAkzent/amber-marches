import type { DecideFn } from './types'

/** Fallback AI: engage nearest living foe. */
export const defaultDecide: DecideFn = (unit, view) => {
  const target = view.nearestEnemy(unit)
  if (!target) return { kind: 'idle' }
  return { kind: 'engage', targetId: target.id }
}
