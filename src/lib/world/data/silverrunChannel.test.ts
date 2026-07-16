import { describe, expect, it } from 'vitest'
import {
  RIVER_MAX_X,
  RIVER_MIN_X,
  SILVERRUN_FORD_X,
  sampleRiver,
  sampleRiverAxis,
} from './silverrunChannel'

describe('Silverrun profile', () => {
  it('is continuous through every authored segment', () => {
    let previous = sampleRiverAxis(RIVER_MIN_X)
    for (let x = RIVER_MIN_X + 0.25; x <= RIVER_MAX_X; x += 0.25) {
      const current = sampleRiverAxis(x)
      expect(Math.abs(current.centerZ - previous.centerZ)).toBeLessThan(0.2)
      expect(Math.abs(current.waterHalfWidth - previous.waterHalfWidth)).toBeLessThan(0.08)
      expect(current.flowDistance).toBeGreaterThan(previous.flowDistance)
      previous = current
    }
  })

  it('carries water, bank and depth data in one sample', () => {
    const axis = sampleRiverAxis(6)
    const center = sampleRiver(6, axis.centerZ)
    const shore = sampleRiver(
      axis.x + axis.normalX * axis.waterHalfWidth,
      axis.centerZ + axis.normalZ * axis.waterHalfWidth,
    )
    expect(center.inWater).toBe(true)
    expect(center.inBank).toBe(true)
    expect(center.bedY).toBeLessThan(shore.bedY)
    expect(axis.bankHalfWidth).toBeGreaterThan(axis.waterHalfWidth)
  })

  it('classifies the authored crossing as a ford and shelves as wadable', () => {
    const ford = sampleRiverAxis(SILVERRUN_FORD_X)
    const deep = sampleRiverAxis(6)
    expect(sampleRiver(ford.x, ford.centerZ).isFord).toBe(true)
    expect(sampleRiver(ford.x, ford.centerZ).isDeep).toBe(false)
    expect(sampleRiver(deep.x, deep.centerZ).isDeep).toBe(true)

    const shelfOffset = deep.waterHalfWidth * 0.75
    const shelf = sampleRiver(deep.x, deep.centerZ + Math.sign(deep.normalZ || 1) * shelfOffset)
    expect(shelf.inWater).toBe(true)
    expect(shelf.isDeep).toBe(false)
  })
})
