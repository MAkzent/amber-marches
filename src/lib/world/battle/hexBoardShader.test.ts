import { describe, expect, it } from 'vitest'
import {
  CELL_KIND,
  atlasIndex,
  atlasSize,
  createTerrainHexPatchGeometry,
  packCellKindData,
} from './hexBoardShader'
import { walkHeight } from '../data/amberMarches'

describe('hex board cell atlas', () => {
  const radius = 2

  it('indexes axial cells by (q+R, r+R) in row-major order', () => {
    expect(atlasSize(radius)).toBe(5)
    expect(atlasIndex(0, 0, radius)).toBe(2 * 5 + 2)
    expect(atlasIndex(-2, -2, radius)).toBe(0)
    expect(atlasIndex(2, 2, radius)).toBe(4 * 5 + 4)
  })

  it('marks in-board cells plain, then overlays deploy and blocked', () => {
    const data = packCellKindData(radius, {
      heroDeploy: [{ q: -1, r: 0 }],
      enemyDeploy: [{ q: 1, r: 0 }],
      blocked: [{ q: 0, r: 1 }],
    })

    expect(data[atlasIndex(0, 0, radius)]).toBe(CELL_KIND.plain)
    expect(data[atlasIndex(-1, 0, radius)]).toBe(CELL_KIND.heroDeploy)
    expect(data[atlasIndex(1, 0, radius)]).toBe(CELL_KIND.enemyDeploy)
    expect(data[atlasIndex(0, 1, radius)]).toBe(CELL_KIND.blocked)
  })

  it('does not paint deploy over blocked cells', () => {
    const data = packCellKindData(radius, {
      heroDeploy: [{ q: 0, r: 0 }],
      enemyDeploy: [],
      blocked: [{ q: 0, r: 0 }],
    })
    expect(data[atlasIndex(0, 0, radius)]).toBe(CELL_KIND.blocked)
  })

  it('leaves out-of-board atlas slots as blocked/empty', () => {
    // Square-atlas corners sit outside the hex disk for R=2 (dist 4).
    const data = packCellKindData(radius, {
      heroDeploy: [],
      enemyDeploy: [],
      blocked: [],
    })
    expect(data[atlasIndex(2, 2, radius)]).toBe(CELL_KIND.blocked)
    expect(data[atlasIndex(-2, -2, radius)]).toBe(CELL_KIND.blocked)
  })

  it('builds inset patches whose vertices follow natural terrain', () => {
    const origin = { x: 1.7, z: -22.95, yaw: Math.PI / 9 }
    const lift = 0.045
    const geometry = createTerrainHexPatchGeometry(origin, 1.15, radius, lift)
    const positions = geometry.attributes.position

    expect(positions.count).toBe(19 * 49)
    for (let i = 0; i < positions.count; i += 17) {
      const worldX = origin.x + positions.getX(i)
      const worldZ = origin.z + positions.getZ(i)
      expect(positions.getY(i)).toBeCloseTo(walkHeight(worldX, worldZ) + lift, 5)
    }
  })
})
