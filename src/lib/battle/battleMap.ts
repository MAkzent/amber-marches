import type { Hex } from './hexsim'

/**
 * Shared tactical-board contract. World encounters add an origin, terrain
 * blocks, and optional authored height overrides to this stable layout.
 */
export type BattleBoardSpec = {
  radius: number
  hexSize: number
  yaw: number
  heroDeploy: readonly Hex[]
  enemyDeploy: readonly Hex[]
}

export const BATTLE_HEX_SIZE = 1.15
export const BOARD_RADIUS = 4

export const HERO_DEPLOY_HEXES: readonly Hex[] = [
  { q: -3, r: -1 },
  { q: -3, r: 0 },
  { q: -3, r: 1 },
  { q: -2, r: -1 },
  { q: -2, r: 0 },
  { q: -2, r: 1 },
  { q: -2, r: 2 },
]

export const ENEMY_DEPLOY_HEXES: readonly Hex[] = [
  { q: 2, r: -1 },
  { q: 2, r: 0 },
  { q: 2, r: 1 },
  { q: 3, r: -1 },
  { q: 3, r: 0 },
  { q: 3, r: 1 },
]

export const DEFAULT_BATTLE_BOARD: BattleBoardSpec = Object.freeze({
  radius: BOARD_RADIUS,
  hexSize: BATTLE_HEX_SIZE,
  yaw: 0,
  heroDeploy: HERO_DEPLOY_HEXES,
  enemyDeploy: ENEMY_DEPLOY_HEXES,
})
