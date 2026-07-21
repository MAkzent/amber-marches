import { describe, expect, it } from 'vitest'
import { Ray, Vector3 } from 'three'
import { hexToWorldXZ } from '../../battle'
import { pickBattleHex } from './battlePicking'

describe('natural terrain battle picking', () => {
  const origin = { x: 4, z: -3, yaw: Math.PI / 6 }
  const heightAt = (x: number, z: number) =>
    0.35 * Math.sin(x * 0.4) + 0.2 * Math.cos(z * 0.3)
  const board = {
    origin,
    boardRadius: 2,
    hexSize: 1.15,
    heightAt,
  }

  it('picks the logical cell on a rotated hilly board', () => {
    const world = hexToWorldXZ({ q: 0, r: -1 }, origin, 1.15)
    const ray = new Ray(
      new Vector3(world.x, heightAt(world.x, world.z) + 10, world.z),
      new Vector3(0, -1, 0),
    )
    const hit = pickBattleHex(ray, board)
    expect(hit?.hex).toEqual({ q: 0, r: -1 })
    expect(hit?.y).toBeCloseTo(heightAt(world.x, world.z), 5)
  })

  it('returns null outside the compact board', () => {
    const ray = new Ray(
      new Vector3(origin.x + 30, 20, origin.z + 30),
      new Vector3(0, -1, 0),
    )
    expect(pickBattleHex(ray, board)).toBeNull()
  })
})
