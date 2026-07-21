import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTACT_BIAS,
  footContactGap,
  groundedFootY,
  groundedRootY,
  sampleTerrainPad,
} from './grounding'
import {
  landmarks,
  landmarkWorldPosition,
  terrainHeight,
} from './amberMarches'

/** Flat plane — isolates foot math from terrain shape. */
const flat = () => 2.5

describe('terrain grounding math', () => {
  it('plants the foot at surface + contactBias when the model sits on local y=0', () => {
    const options = { x: 0, z: 0, heightAt: flat, contactBias: 0.04, scale: 2 }
    expect(groundedRootY(options)).toBeCloseTo(2.54, 5)
    expect(groundedFootY(options)).toBeCloseTo(2.54, 5)
    expect(footContactGap(options)).toBeCloseTo(0.04, 5)
  })

  it('compensates for a model whose geometry foot is below the pivot', () => {
    // bbox.min.y = -0.5, scale 2 → foot is 1 unit below root
    const options = {
      x: 0,
      z: 0,
      heightAt: flat,
      footLocalY: -0.5,
      scale: 2,
      contactBias: 0.04,
    }
    expect(groundedRootY(options)).toBeCloseTo(2.54 - -0.5 * 2, 5)
    expect(groundedFootY(options)).toBeCloseTo(2.54, 5)
  })

  it('uses pad max so uphill feet do not clip into a slope', () => {
    // Slope rising in +X: height = x
    const slope = (x: number) => x
    const center = sampleTerrainPad(0, 0, 2, slope, 'center')
    const max = sampleTerrainPad(0, 0, 2, slope, 'max', 8)
    expect(center).toBeCloseTo(0, 5)
    expect(max).toBeGreaterThan(1.5)
  })

  it('defaults contact bias to the shared constant', () => {
    expect(groundedRootY({ x: 0, z: 0, heightAt: flat })).toBeCloseTo(
      2.5 + DEFAULT_CONTACT_BIAS,
      5,
    )
  })
})

describe('landmark placement invariants', () => {
  it('never authors a free world Y — placements are XZ + grounding only', () => {
    for (const landmark of landmarks) {
      expect(landmark).toHaveProperty('xz')
      expect(landmark).not.toHaveProperty('position')
      expect(landmark.contactBias ?? DEFAULT_CONTACT_BIAS).toBeLessThan(0.5)
    }
  })

  it('keeps every landmark foot within a small contact band of the terrain', () => {
    for (const landmark of landmarks) {
      const [x, , z] = landmarkWorldPosition(landmark)
      const gap = footContactGap({
        x,
        z,
        heightAt: terrainHeight,
        footLocalY: landmark.footLocalY,
        scale: landmark.scale,
        contactBias: landmark.contactBias,
        padRadius: landmark.padRadius,
        padMode: landmark.padMode,
      })
      // Pad-max can lift slightly above center; allow that, but never float by meters.
      expect(gap).toBeGreaterThanOrEqual(-0.05)
      expect(gap).toBeLessThan(0.55)
    }
  })

  it('plants the watchtower on the mound instead of stacking an authored lift', () => {
    const tower = landmarks.find((entry) => entry.id === 'watchtower')
    expect(tower).toBeTruthy()
    const [, y] = landmarkWorldPosition(tower!)
    const surface = terrainHeight(22, -22)
    // Old bug: terrainHeight + 1.5 floated the KayKit tower above the mound.
    expect(y - surface).toBeLessThan(0.2)
    expect(y).toBeGreaterThan(surface - 0.05)
  })

  it('plants the mill on the terrain instead of lifting by blade-local AABB', () => {
    const mill = landmarks.find((entry) => entry.id === 'mill')
    expect(mill).toBeTruthy()
    expect(mill!.footLocalY ?? 0).toBe(0)
    const [, y] = landmarkWorldPosition(mill!)
    const surface = terrainHeight(mill!.xz[0], mill!.xz[1])
    // Old bug: footLocalY = −0.689 (blade local) raised root by ~scale×0.689.
    expect(y - surface).toBeLessThan(0.2)
    expect(y).toBeGreaterThan(surface - 0.05)
  })

  it('grounds the far castle on the rebuilt mountain summit', () => {
    const castle = landmarks.find((entry) => entry.id === 'far-castle')!
    const [, y] = landmarkWorldPosition(castle)
    const surface = terrainHeight(castle.xz[0], castle.xz[1])
    expect(y).toBeCloseTo(surface + DEFAULT_CONTACT_BIAS, 5)
    expect(surface).toBeGreaterThan(3.5)
  })
})
