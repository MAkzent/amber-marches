import { describe, expect, it } from 'vitest'
import {
  BOARD_RADIUS,
  WORLD_HEX_SIZE,
  hexesWithin,
  hexToWorldXZ,
} from '../../battle'
import { ENCOUNTER_ORIGIN } from '../battle/battleBridge'
import { walkHeight } from '../data/sunmereVale'
import { BATTLE_TUNING_DEFAULTS } from './battleTuning'
import {
  boardExtentsXZ,
  projectToNdc,
  resolveBattleFrame,
} from './battleFrame'

describe('battleFrame', () => {
  const origin = { ...ENCOUNTER_ORIGIN, yaw: 0 }
  const groundY = 0
  const aspect = 16 / 9

  it('computes a board AABB covering the hex disk plus margin', () => {
    const extents = boardExtentsXZ(origin, BOARD_RADIUS, WORLD_HEX_SIZE, 0.35)
    // Pointy-top radius-5 disk ≈ ±10m in X and Z before margin.
    expect(extents.maxX - extents.minX).toBeGreaterThan(18)
    expect(extents.maxZ - extents.minZ).toBeGreaterThan(16)
    expect(extents.points.length).toBe(8)
    // Origin sits inside the AABB.
    expect(origin.x).toBeGreaterThan(extents.minX)
    expect(origin.x).toBeLessThan(extents.maxX)
    expect(origin.z).toBeGreaterThan(extents.minZ)
    expect(origin.z).toBeLessThan(extents.maxZ)
  })

  it('fits board samples inside the lower tactical overview', () => {
    const tuning = { ...BATTLE_TUNING_DEFAULTS }
    const frame = resolveBattleFrame({ origin, groundY, tuning, aspect })
    expect(frame.distance).toBeGreaterThanOrEqual(tuning.distanceMin)
    expect(frame.distance).toBeLessThanOrEqual(tuning.distanceMax)

    const flatDistance = Math.hypot(
      frame.pos.x - frame.look.x,
      frame.pos.z - frame.look.z,
    )
    const elevation =
      Math.atan2(frame.pos.y - frame.look.y, flatDistance) * (180 / Math.PI)
    expect(elevation).toBeGreaterThan(38)
    expect(elevation).toBeLessThan(46)

    const extents = boardExtentsXZ(origin, BOARD_RADIUS, WORLD_HEX_SIZE, tuning.boardMargin)
    const limitX = 1 - tuning.padX
    const limitY = 1 - tuning.padY
    for (const p of extents.points) {
      const ndc = projectToNdc(
        { x: p.x, y: groundY, z: p.z },
        frame.pos,
        frame.look,
        frame.fov,
        aspect,
      )
      expect(ndc).not.toBeNull()
      expect(Math.abs(ndc!.x)).toBeLessThanOrEqual(limitX + 0.02)
      expect(Math.abs(ndc!.y)).toBeLessThanOrEqual(limitY + 0.02)
    }
  })

  it('pulls in when padding is relaxed', () => {
    const tight = resolveBattleFrame({
      origin,
      groundY,
      tuning: { ...BATTLE_TUNING_DEFAULTS, padX: 0.12, padY: 0.05 },
      aspect,
    })
    const loose = resolveBattleFrame({
      origin,
      groundY,
      tuning: { ...BATTLE_TUNING_DEFAULTS, padX: -0.05, padY: -0.2 },
      aspect,
    })
    expect(loose.distance).toBeLessThan(tight.distance)
  })

  it('moves the board higher when positive vertical focus bias is requested', () => {
    const neutral = resolveBattleFrame({
      origin,
      groundY,
      tuning: { ...BATTLE_TUNING_DEFAULTS, focusNdcY: 0 },
      aspect,
    })
    const raised = resolveBattleFrame({
      origin,
      groundY,
      tuning: { ...BATTLE_TUNING_DEFAULTS, focusNdcY: 0.08 },
      aspect,
    })
    const center = { x: origin.x, y: groundY, z: origin.z }
    const neutralNdc = projectToNdc(center, neutral.pos, neutral.look, neutral.fov, aspect)
    const raisedNdc = projectToNdc(center, raised.pos, raised.look, raised.fov, aspect)

    expect(raisedNdc!.y).toBeGreaterThan(neutralNdc!.y)
  })

  it('fits naturally elevated unit heads in a portrait safe frame', () => {
    const surfaceCells = hexesWithin({ q: 0, r: 0 }, BOARD_RADIUS).map((hex) => {
      const world = hexToWorldXZ(hex, origin, WORLD_HEX_SIZE)
      return { hex, y: walkHeight(world.x, world.z) }
    })
    const unitPoints = surfaceCells
      .filter((cell) => Math.abs(cell.hex.q) >= 2)
      .slice(0, 7)
      .map((cell) => {
        const world = hexToWorldXZ(cell.hex, origin, WORLD_HEX_SIZE)
        return { ...world, y: cell.y + 4.5 }
      })
    const frame = resolveBattleFrame({
      origin,
      groundY,
      tuning: BATTLE_TUNING_DEFAULTS,
      aspect: 9 / 16,
      surfaceCells,
      unitPoints,
    })
    expect(frame.distance).toBeGreaterThan(BATTLE_TUNING_DEFAULTS.distanceMin)
    expect(frame.distance).toBeLessThan(BATTLE_TUNING_DEFAULTS.distanceMax)
    for (const point of unitPoints) {
      const ndc = projectToNdc(
        point,
        frame.pos,
        frame.look,
        frame.fov,
        9 / 16,
      )
      expect(ndc).not.toBeNull()
      expect(Math.abs(ndc!.x)).toBeLessThanOrEqual(0.92)
      expect(Math.abs(ndc!.y)).toBeLessThanOrEqual(0.92)
    }
  })
})
