import { describe, expect, it } from 'vitest'
import { createRiverSurfaceGeometry } from './riverGeometry'

describe('performance-first river geometry', () => {
  it('stays inside the Silverrun vertex and triangle budget', () => {
    const geometry = createRiverSurfaceGeometry()
    expect(geometry.getAttribute('position').count).toBeLessThanOrEqual(1200)
    expect((geometry.index?.count ?? 0) / 3).toBeLessThanOrEqual(2100)
    expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aFlow').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aFord').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aDepth').count).toBe(geometry.getAttribute('position').count)
  })

  it('faces upward so the water remains single-sided', () => {
    const geometry = createRiverSurfaceGeometry(2, 2)
    const normals = geometry.getAttribute('normal')
    for (let index = 0; index < normals.count; index += 1) {
      expect(normals.getY(index)).toBeGreaterThan(0.85)
    }
  })
})
