/**
 * Contract between battle RULES (hexsim) and presentation.
 * Per frame: fractionalHexOf + unit fields. Per step: SimEvent[].
 */

import type { Hex } from './hex'

export interface HexUnitStats {
  maxHp: number
  attackDamage: number
  /** seconds to traverse one hex */
  secondsPerHex: number
  /** basic-attack reach in hexes (1 = melee adjacency) */
  attackRangeHexes: number
  /** seconds between basic attacks (start → start) */
  attackCooldownSeconds: number
  /** seconds from attack start until the blow lands */
  attackWindupSeconds: number
  /** seconds the attack occupies the unit (windup + recover) */
  attackDurationSeconds: number
  /** tie-break / pacing */
  speed: number
}

export type UnitActivity =
  | { kind: 'idle' }
  | { kind: 'moving'; from: Hex; to: Hex; t: number; duration: number }
  | { kind: 'attacking'; targetId: string; elapsed: number; fired?: boolean }

export interface HexUnit {
  id: string
  /** presentation key (sprite catalog) */
  actorId: string
  team: 'hero' | 'enemy'
  hex: Hex
  hp: number
  alive: boolean
  stats: HexUnitStats
  activity: UnitActivity
  /** seconds until ready, keyed by 'attack' */
  cooldowns: Record<string, number>
  repathWait: number
  engageTargetId?: string
  chaseMoves: number
}

export interface UnitSpawn {
  id: string
  actorId: string
  team: 'hero' | 'enemy'
  hex: Hex
  stats: HexUnitStats
}

export type Intent =
  | { kind: 'engage'; targetId: string }
  | { kind: 'idle' }

export type SimEvent =
  | { type: 'attackStart'; at: number; unitId: string; targetId: string; projectile: boolean }
  | { type: 'projectile'; at: number; unitId: string; targetId: string; flightSeconds: number }
  | { type: 'hit'; at: number; unitId: string; targetId: string; amount: number }
  | { type: 'die'; at: number; unitId: string }

export interface SimView {
  time: number
  unitsOf(team: 'hero' | 'enemy'): HexUnit[]
  enemiesOf(unit: HexUnit): HexUnit[]
  nearestEnemy(unit: HexUnit): HexUnit | null
  isPassable(hex: Hex, unit: HexUnit): boolean
}

export type DecideFn = (unit: HexUnit, view: SimView) => Intent

export interface SimConfig {
  boardRadius: number
  seed: number
  decide: DecideFn
  blocked?: Hex[]
}
