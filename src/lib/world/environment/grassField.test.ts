import { describe, expect, it } from 'vitest'
import { BoxGeometry, type Mesh } from 'three'
import {
  blocksGrass,
  createKenneyGrassField,
  sampleGrassTufts,
} from './grassField'
import { collisionCircles, onBridgeDeck, sampleRiver } from '../data/sunmereVale'

describe('blocksGrass', () => {
  it('clears only solid building footprints so yards can grow lawn', () => {
    const house = collisionCircles[0]
    // Deep inside the collider — blocked.
    expect(blocksGrass(house.x, house.z)).toBe(true)
    // Just outside the old oversized padding ring — should grow grass now.
    const edge = house.radius * 0.95
    expect(blocksGrass(house.x + edge, house.z)).toBe(false)
    // Village plaza center (was a blanket dead zone) — lawn allowed.
    expect(blocksGrass(-9, 10)).toBe(false)
  })
})

describe('sampleGrassTufts', () => {
  it('plants a dense Kenney lawn and keeps tufts off water / bridge', () => {
    const tufts = sampleGrassTufts()
    expect(tufts.length).toBeGreaterThan(8000)
    expect(tufts.length).toBeLessThan(45000)

    for (const tuft of tufts) {
      expect(sampleRiver(tuft.x, tuft.z).inBank).toBe(false)
      expect(onBridgeDeck(tuft.x, tuft.z, 0.55)).toBe(false)
      expect(blocksGrass(tuft.x, tuft.z)).toBe(false)
    }
  })

  it('keeps roots on the heightfield surface', () => {
    const sample = sampleGrassTufts().slice(0, 200)
    for (const tuft of sample) {
      expect(tuft.y).toBeGreaterThan(-2)
      expect(tuft.y).toBeLessThan(6)
    }
  })
})

describe('createKenneyGrassField', () => {
  it('builds shadowed instanced tiles from Kenney geometries', () => {
    const tufts = sampleGrassTufts().slice(0, 400)
    const field = createKenneyGrassField(new BoxGeometry(0.2, 0.25, 0.2), new BoxGeometry(0.1, 0.14, 0.1), tufts)
    expect(field.root.children.length).toBeGreaterThan(0)
    const mesh = field.root.children[0] as Mesh
    expect(mesh.receiveShadow).toBe(true)
    expect(mesh.castShadow).toBe(false)
    field.dispose()
  })
})
