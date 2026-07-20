/**
 * Ring buffer of swing events — same pattern as river disturbances.
 * Combat consumers (hit queries, VFX) sample each frame; unused age-out.
 */

import type { Facing } from '../actors/spriteSheet'
import type { AttackSwingEvent } from './types'

export const MAX_ATTACK_SWINGS = 12

const swings: AttackSwingEvent[] = []
let nextSwingId = 1

export function getAttackSwings() {
  return swings
}

export function pushAttackSwing(
  attackerId: string,
  moduleId: string,
  x: number,
  z: number,
  facing: Facing,
  targetId?: string,
) {
  if (swings.length >= MAX_ATTACK_SWINGS) swings.shift()
  const swing = {
    id: nextSwingId++,
    attackerId,
    moduleId,
    x,
    z,
    facing,
    targetId,
    age: 0,
  }
  swings.push(swing)
  return swing
}

export function tickAttackSwings(delta: number) {
  for (let index = swings.length - 1; index >= 0; index -= 1) {
    const swing = swings[index]
    swing.age += delta
    if (swing.age > 0.35) swings.splice(index, 1)
  }
}

export function clearAttackSwings() {
  swings.length = 0
}
