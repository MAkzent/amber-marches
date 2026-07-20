import type { AttackModule } from './types'

/** Basic melee behavior; each character supplies its own animation impact frame. */
export const AUTO_ATTACK: AttackModule = {
  id: 'auto-attack',
  kind: 'auto',
  name: 'Auto Attack',
  cooldown: 0.55,
  motion: 'attack',
  lockMovement: true,
  damage: 24,
  delivery: {
    kind: 'melee-arc',
    range: 2.35,
    arcDegrees: 120,
  },
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
