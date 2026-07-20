import { getAttackModule } from './modules'
import type {
  ActorAttackState,
  AttackAnimationTiming,
  AttackModule,
  AttackSlotBinding,
  AttackTickResult,
} from './types'

export function createAttackState(): ActorAttackState {
  return { cooldowns: {}, active: null }
}

export function attackAnimationDuration(animation: AttackAnimationTiming) {
  return animation.frameCount * animation.frameSeconds
}

export function attackImpactTime(animation: AttackAnimationTiming) {
  return animation.impactFrame * animation.frameSeconds
}

function isValidAnimation(
  animation: AttackAnimationTiming | undefined,
): animation is AttackAnimationTiming {
  return Boolean(
    animation &&
      animation.frameCount > 0 &&
      animation.frameSeconds > 0 &&
      animation.impactFrame >= 0 &&
      animation.impactFrame < animation.frameCount,
  )
}

export function moduleForSlot(
  loadout: AttackSlotBinding[],
  slot: number,
): AttackModule | undefined {
  const binding = loadout.find((entry) => entry.slot === slot)
  if (!binding) return undefined
  return getAttackModule(binding.moduleId)
}

/**
 * Attempt to fire the module bound to a hotbar slot.
 * Returns the module when activation succeeds.
 */
export function tryActivateSlot(
  state: ActorAttackState,
  loadout: AttackSlotBinding[],
  slot: number,
  animation: AttackAnimationTiming | undefined,
): AttackModule | null {
  if (state.active) return null
  const module = moduleForSlot(loadout, slot)
  if (!module || !isValidAnimation(animation)) return null
  const remaining = state.cooldowns[module.id] ?? 0
  if (remaining > 0) return null
  state.active = {
    moduleId: module.id,
    elapsed: 0,
    hitFired: false,
    animation: { ...animation },
  }
  state.cooldowns[module.id] = module.cooldown
  return module
}

export function isMovementLocked(state: ActorAttackState): boolean {
  if (!state.active) return false
  const module = getAttackModule(state.active.moduleId)
  return Boolean(module?.lockMovement)
}

export function activeAttackMotion(state: ActorAttackState): AttackModule['motion'] | null {
  if (!state.active) return null
  return getAttackModule(state.active.moduleId)?.motion ?? null
}

/** Advance cooldowns + active attack; reports the hit window once. */
export function tickAttack(state: ActorAttackState, delta: number): AttackTickResult {
  for (const id of Object.keys(state.cooldowns)) {
    const next = state.cooldowns[id] - delta
    if (next <= 0) delete state.cooldowns[id]
    else state.cooldowns[id] = next
  }

  if (!state.active) {
    return { active: null, hitJustFired: false, hitModule: null, movementLocked: false }
  }

  const module = getAttackModule(state.active.moduleId)
  if (!module) {
    state.active = null
    return { active: null, hitJustFired: false, hitModule: null, movementLocked: false }
  }

  state.active.elapsed += delta
  let hitJustFired = false
  const hitTime = attackImpactTime(state.active.animation)
  if (!state.active.hitFired && state.active.elapsed >= hitTime) {
    state.active.hitFired = true
    hitJustFired = true
  }

  if (state.active.elapsed >= attackAnimationDuration(state.active.animation)) {
    state.active = null
    return {
      active: null,
      hitJustFired,
      hitModule: hitJustFired ? module : null,
      movementLocked: false,
    }
  }

  return {
    active: module,
    hitJustFired,
    hitModule: hitJustFired ? module : null,
    movementLocked: module.lockMovement,
  }
}
