import {
  DEFAULT_BATTLE_BOARD,
  type BattleBoardSpec,
  type BoardOrigin,
} from '../../battle'

export type WorldBattleMap = BattleBoardSpec & {
  origin: BoardOrigin
  triggerRadius: number
}

/** Compact Amber Marches skirmish played directly on the natural vale terrain. */
export const AMBER_MARCHES_BATTLE_MAP: WorldBattleMap = {
  ...DEFAULT_BATTLE_BOARD,
  origin: { x: 1.7, z: -22.95, yaw: DEFAULT_BATTLE_BOARD.yaw },
  triggerRadius: 6.2,
}
