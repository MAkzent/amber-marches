import type { Facing, Motion } from '../actors/spriteSheet'

/** Kind of combat module — auto swings vs authored skills later. */
export type AttackKind = 'auto' | 'skill'

export type CombatFaction = 'party' | 'enemy'

/**
 * Delivery stays separate from damage so later projectile and spell systems can
 * resolve travel/impact before handing the same damage packet to the engine.
 */
export type AbilityDelivery = {
  kind: 'melee-arc'
  range: number
  arcDegrees: number
}

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
  /** Sprite motion to play while active. */
  motion: Motion
  /** When true, the actor cannot move for its authored animation duration. */
  lockMovement: boolean
  damage: number
  delivery: AbilityDelivery
}

/**
 * Character-specific sprite timing. `impactFrame` is zero-based and fires as
 * that authored frame begins, keeping gameplay impact tied to the actual art.
 */
export type AttackAnimationTiming = {
  frameCount: number
  frameSeconds: number
  impactFrame: number
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
  animation: AttackAnimationTiming
}

export type ActorAttackState = {
  cooldowns: Record<string, number>
  active: ActiveAttack | null
}

/** Emitted once per activation at the authored hit window. */
export type AttackSwingEvent = {
  id: number
  attackerId: string
  moduleId: string
  x: number
  z: number
  facing: Facing
  /** Sticky target chosen when the ability began; omitted for free-direction attacks. */
  targetId?: string
  age: number
}

export type Combatant = {
  id: string
  faction: CombatFaction
  x: number
  z: number
  radius: number
  health: number
  maxHealth: number
  alive: boolean
}

export type DamageEvent = {
  id: number
  swingId: number
  sourceId: string
  targetId: string
  amount: number
  remainingHealth: number
  defeated: boolean
  x: number
  y: number
  z: number
  age: number
  /** Filled by the canvas projection bridge for the DOM overlay. */
  screenX: number
  screenY: number
  onScreen: boolean
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
