import { Ray, Vector3 } from 'three'
import {
  hexDistance,
  worldXZToHex,
  type BoardOrigin,
  type Hex,
} from '../../battle'
import { intersectHeightfield } from '../data/heightfieldPick'
import { walkHeight } from '../data/amberMarches'

export type BattleHexHit = {
  hex: Hex
  x: number
  y: number
  z: number
  distance: number
}

const hitPoint = new Vector3()

export type BattlePickBoard = {
  origin: BoardOrigin
  boardRadius: number
  hexSize: number
  heightAt?: (x: number, z: number) => number
}

/** Pick the natural walk surface, then resolve that XZ through the sim's hex projection. */
export function pickBattleHex(ray: Ray, board: BattlePickBoard): BattleHexHit | null {
  const hit = intersectHeightfield(ray.origin, ray.direction, hitPoint, {
    heightAt: board.heightAt ?? walkHeight,
  })
  if (!hit) return null

  const hex = worldXZToHex(
    hitPoint.x,
    hitPoint.z,
    board.origin,
    board.hexSize,
  )
  if (hexDistance(hex, { q: 0, r: 0 }) > board.boardRadius) return null

  return {
    hex,
    x: hitPoint.x,
    y: hitPoint.y,
    z: hitPoint.z,
    distance: ray.origin.distanceTo(hitPoint),
  }
}
