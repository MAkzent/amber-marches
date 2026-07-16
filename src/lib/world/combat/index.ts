export type {
  ActiveAttack,
  ActorAttackState,
  AttackKind,
  AttackModule,
  AttackSlotBinding,
  AttackSwingEvent,
  AttackTickResult,
} from './types'
export {
  ATTACK_MODULES,
  AUTO_ATTACK,
  getAttackModule,
  registerAttackModule,
} from './modules'
export {
  activeAttackMotion,
  createAttackState,
  isMovementLocked,
  moduleForSlot,
  tickAttack,
  tryActivateSlot,
} from './controller'
export {
  getAttackSwings,
  MAX_ATTACK_SWINGS,
  pushAttackSwing,
  tickAttackSwings,
} from './attackEvents'

/** Default leader loadout — slot 1 is the basic auto attack. */
export const LEADER_ATTACK_LOADOUT = [{ slot: 1, moduleId: 'auto-attack' }] as const
