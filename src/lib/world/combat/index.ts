export type {
  ActiveAttack,
  AbilityDelivery,
  ActorAttackState,
  AttackAnimationTiming,
  AttackKind,
  AttackModule,
  AttackSlotBinding,
  AttackSwingEvent,
  AttackTickResult,
  Combatant,
  CombatFaction,
  DamageEvent,
} from './types'
export {
  ATTACK_MODULES,
  AUTO_ATTACK,
  getAttackModule,
  registerAttackModule,
} from './modules'
export {
  activeAttackMotion,
  attackAnimationDuration,
  attackImpactTime,
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
  clearAttackSwings,
} from './attackEvents'
export {
  createSwingResolver,
  facingVector,
  findFocusTarget,
  isInsideMeleeArc,
  resolveSwing,
} from './engine'
export {
  abilityInput,
  combatDelta,
  combatAudioEvent,
  combatFocus,
  combatHud,
  combatImpact,
  consumeAbilitySlots,
  damageEvents,
  emitCombatAudio,
  getCombatants,
  getLivingEnemyColliders,
  nextDamageId,
  publishCombatHud,
  pushCombatImpact,
  pushDamageEvents,
  requestAbilitySlot,
  resetCombatRuntime,
  setCombatFocusTarget,
  setCombatants,
  tickDamageEvents,
} from './runtime'
export { PASSIVE_ENEMIES, type EnemyDefinition } from './encounter'

/** Default leader loadout — slot 1 is the basic auto attack. */
export const LEADER_ATTACK_LOADOUT = [{ slot: 1, moduleId: 'auto-attack' }] as const
