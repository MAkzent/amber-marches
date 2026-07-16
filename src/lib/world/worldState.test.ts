import { get } from 'svelte/store'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  completedDiscoveries,
  completeNearby,
  discoveries,
  dusk,
  nearbyDiscovery,
  resetWorld,
} from './worldState'

describe('world discovery mutations', () => {
  beforeEach(resetWorld)

  it('persists each discovery and turns the watchtower into dusk', () => {
    for (const discovery of discoveries) {
      nearbyDiscovery.set(discovery)
      completeNearby()
    }

    expect(get(completedDiscoveries)).toEqual(new Set(discoveries.map((discovery) => discovery.id)))
    expect(get(dusk)).toBe(true)
  })
})
