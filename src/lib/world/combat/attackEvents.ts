/**
 * Ring buffer of swing events — same pattern as river disturbances.
 * Combat consumers (hit queries, VFX) sample each frame; unused age-out.
 */

import type { Facing } from '../actors/spriteSheet'
import type { AttackSwingEvent } from './types'

export const MAX_ATTACK_SWINGS = 12

const swings: AttackSwingEvent[] = []

export function getAttackSwings() {
  return swings
}

export function pushAttackSwing(
  attackerId: string,
  moduleId: string,
  x: number,
  z: number,
  facing: Facing,
  range: number,
) {
  if (swings.length >= MAX_ATTACK_SWINGS) swings.shift()
  swings.push({ attackerId, moduleId, x, z, facing, range, age: 0 })
}

export function tickAttackSwings(delta: number) {
  for (let index = swings.length - 1; index >= 0; index -= 1) {
    const swing = swings[index]
    swing.age += delta
    if (swing.age > 0.35) swings.splice(index, 1)
  }
}
