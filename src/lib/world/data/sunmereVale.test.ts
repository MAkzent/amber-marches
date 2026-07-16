import { describe, expect, it } from 'vitest'
import {
  SILVERRUN_BRIDGE,
  bridgeDeckBlend,
  isWalkable,
  onBridgeDeck,
  scenery,
  terrainHeight,
  walkHeight,
} from './sunmereVale'

describe('Sunmere Vale scene data', () => {
  it('keeps deterministic scenery within the authored world', () => {
    expect(scenery.length).toBeGreaterThan(70)
    expect(scenery[0]).toMatchObject({
      kind: expect.stringMatching(/oak|pine|rock|flower/),
    })
  })

  it('blocks deep river travel but leaves the bridge crossing open', () => {
    expect(isWalkable(-20, -2)).toBe(false)
    expect(isWalkable(6, -2)).toBe(true)
  })

  it('aligns isWalkable bridge gate with the deck ellipse', () => {
    expect(onBridgeDeck(6, -2)).toBe(true)
    expect(isWalkable(6, -2)).toBe(true)
    // Past the deck ellipse in +X, still in the river channel — blocked.
    const offDeckX = SILVERRUN_BRIDGE.x + SILVERRUN_BRIDGE.radiusX + 0.2
    expect(onBridgeDeck(offDeckX, -2)).toBe(false)
    expect(isWalkable(offDeckX, -2)).toBe(false)
  })

  it('raises the watchtower landmark above the river basin', () => {
    expect(terrainHeight(22, -22)).toBeGreaterThan(terrainHeight(6, -2))
  })

  it('lifts the walk surface onto the Silverrun bridge deck', () => {
    expect(walkHeight(6, -2)).toBeGreaterThan(terrainHeight(6, -2) + 0.5)
    expect(walkHeight(6, -2)).toBeCloseTo(SILVERRUN_BRIDGE.deckY, 5)
    // Deck aligns with the placed GLB (not a floating authored Y).
    expect(SILVERRUN_BRIDGE.deckY).toBeLessThan(0.7)
    expect(walkHeight(6, -2)).toBeGreaterThan(walkHeight(-20, -2))
  })

  it('blends walkHeight to terrain at the deck ellipse edge', () => {
    expect(bridgeDeckBlend(SILVERRUN_BRIDGE.x, SILVERRUN_BRIDGE.z)).toBeCloseTo(1, 5)
    const edgeX = SILVERRUN_BRIDGE.x + SILVERRUN_BRIDGE.radiusX
    expect(bridgeDeckBlend(edgeX, SILVERRUN_BRIDGE.z)).toBeCloseTo(0, 5)
    expect(walkHeight(edgeX, SILVERRUN_BRIDGE.z)).toBeCloseTo(
      terrainHeight(edgeX, SILVERRUN_BRIDGE.z),
      5,
    )
  })

  it('does not elevate walkHeight inside house footprints (houses are blockers)', () => {
    // Near house-west: walk surface is plain terrain — buildings are XZ discs, not roofs.
    const x = -13
    const z = 10
    expect(walkHeight(x, z)).toBeCloseTo(terrainHeight(x, z), 5)
  })
})
