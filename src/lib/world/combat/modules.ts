import type { AttackModule } from './types'

/**
 * Paladin basic swing — timing matches the 6-frame True Heroes Attack sheet
 * at FRAME_SECONDS.attack (0.08s) ≈ 0.48s total.
 */
export const AUTO_ATTACK: AttackModule = {
  id: 'auto-attack',
  kind: 'auto',
  name: 'Auto Attack',
  cooldown: 0.55,
  duration: 0.48,
  hitAt: 0.45,
  motion: 'attack',
  lockMovement: true,
  range: 1.85,
}

/** Global module catalog — register skills here as they are authored. */
export const ATTACK_MODULES: Record<string, AttackModule> = {
  [AUTO_ATTACK.id]: AUTO_ATTACK,
}

export function getAttackModule(id: string): AttackModule | undefined {
  return ATTACK_MODULES[id]
}

export function registerAttackModule(module: AttackModule) {
  ATTACK_MODULES[module.id] = module
}
