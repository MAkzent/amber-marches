import { describe, expect, it } from 'vitest'
import { calculatePixelGrid } from './pixelGrid'

describe('calculatePixelGrid', () => {
  it.each([
    { width: 448, height: 970, dpr: 1.15 },
    { width: 970, height: 448, dpr: 1.15 },
    { width: 1010, height: 631, dpr: 1 },
    { width: 2532, height: 1170, dpr: 3 },
  ])('keeps effect pixels square at $width×$height', ({ width, height, dpr }) => {
    const grid = calculatePixelGrid(width, height, dpr)
    const cellWidth = grid.cellUvX * width
    const cellHeight = grid.cellUvY * height

    expect(cellWidth).toBeCloseTo(cellHeight, 12)
    expect(grid.columns / grid.rows).toBeCloseTo(width / height, 12)
    expect(grid.framebufferPixelSize / dpr).toBeCloseTo(2, 12)
  })

  it('stays finite while a mobile viewport is collapsing during rotation', () => {
    const grid = calculatePixelGrid(0, Number.NaN, 0)

    expect(Object.values(grid).every(Number.isFinite)).toBe(true)
    expect(grid.cellUvX).toBe(1)
    expect(grid.cellUvY).toBe(1)
  })
})
