import type { Facing, Motion } from '../actors/spriteSheet'

/** Kind of combat module — auto swings vs authored skills later. */
export type AttackKind = 'auto' | 'skill'

/**
 * Declarative combat module. Slot bindings + actor controllers resolve these
 * by id so new skills can register without touching input or HeroParty.
 */
export type AttackModule = {
  id: string
  kind: AttackKind
  name: string
  /** Seconds from activation before this module can fire again. */
  cooldown: number
  /** Seconds the attack anim / lockout lasts. */
  duration: number
  /** Fraction of duration (0..1) when the swing connects. */
  hitAt: number
  /** Sprite motion to play while active. */
  motion: Motion
  /** When true, the actor cannot walk/run for `duration`. */
  lockMovement: boolean
  /** Melee / skill reach in world XZ units (for future hit queries). */
  range: number
}

/** Hotbar-style binding: keyboard slot → module id. */
export type AttackSlotBinding = {
  slot: number
  moduleId: string
}

export type ActiveAttack = {
  moduleId: string
  elapsed: number
  hitFired: boolean
}

export type ActorAttackState = {
  cooldowns: Record<string, number>
  active: ActiveAttack | null
}

/** Emitted once per swing at the hit window — enemies can sample later. */
export type AttackSwingEvent = {
  attackerId: string
  moduleId: string
  x: number
  z: number
  facing: Facing
  range: number
  age: number
}

export type AttackTickResult = {
  /** Module currently playing, if any. */
  active: AttackModule | null
  /** True on the frame the hit window fires. */
  hitJustFired: boolean
  /** Module that connected this frame (set when `hitJustFired`). */
  hitModule: AttackModule | null
  /** True while locomotion should be suppressed. */
  movementLocked: boolean
}
