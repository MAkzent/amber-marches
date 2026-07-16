import { get } from 'svelte/store'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  activeDialogue,
  activeToast,
  advanceDialogue,
  cameraMode,
  combatLive,
  completedDiscoveries,
  completeNearby,
  discoveries,
  dusk,
  markDialogueReady,
  nearbyDiscovery,
  pulseCombat,
  resetWorld,
  startDialogue,
  tickCombatLive,
} from './worldState'

describe('world discovery mutations', () => {
  beforeEach(resetWorld)

  it('persists each discovery and turns the watchtower into dusk', () => {
    for (const discovery of discoveries) {
      if (discovery.dialogue?.length) {
        startDialogue(discovery)
        markDialogueReady()
        while (get(activeDialogue)) advanceDialogue()
      } else {
        nearbyDiscovery.set(discovery)
        completeNearby()
      }
    }

    expect(get(completedDiscoveries)).toEqual(new Set(discoveries.map((discovery) => discovery.id)))
    expect(get(dusk)).toBe(true)
  })

  it('frames the Bellkeeper with the camera before dialogue advances', () => {
    const villager = discoveries.find((discovery) => discovery.id === 'villager')
    expect(villager?.dialogue?.length).toBeGreaterThan(0)

    nearbyDiscovery.set(villager!)
    completeNearby()

    expect(get(activeDialogue)?.discovery.id).toBe('villager')
    expect(get(activeDialogue)?.ready).toBe(false)
    expect(get(cameraMode).kind).toBe('converse')
    expect(get(completedDiscoveries).has('villager')).toBe(false)

    advanceDialogue()
    expect(get(activeDialogue)?.lineIndex).toBe(0)

    markDialogueReady()
    expect(get(activeDialogue)?.ready).toBe(true)

    advanceDialogue()
    expect(get(activeDialogue)?.lineIndex).toBe(1)

    while (get(activeDialogue)) advanceDialogue()

    expect(get(completedDiscoveries).has('villager')).toBe(true)
    expect(get(activeToast)?.id).toBe('villager')
    expect(get(activeDialogue)).toBeNull()
    expect(get(cameraMode).kind).toBe('explore')
  })
})

describe('combat engagement', () => {
  beforeEach(resetWorld)

  it('pulses the combat flag and eases intensity in and out', () => {
    expect(combatLive.engaged).toBe(false)
    expect(combatLive.intensity).toBe(0)

    pulseCombat(0.4)
    expect(combatLive.engaged).toBe(true)
    expect(combatLive.linger).toBeGreaterThan(0)

    tickCombatLive(0.05)
    expect(combatLive.intensity).toBeGreaterThan(0)
    expect(combatLive.engaged).toBe(true)

    tickCombatLive(0.5, true)
    expect(combatLive.engaged).toBe(false)
    expect(combatLive.intensity).toBe(0)
  })

  it('releases combat intensity slower than it engages', () => {
    pulseCombat(1)
    tickCombatLive(0.25)
    const afterIn = combatLive.intensity
    expect(afterIn).toBeGreaterThan(0.5)

    combatLive.engaged = false
    combatLive.linger = 0
    tickCombatLive(0.25)
    const dropOut = afterIn - combatLive.intensity

    combatLive.intensity = 0
    combatLive.engaged = true
    combatLive.linger = 1
    tickCombatLive(0.25)
    const riseIn = combatLive.intensity

    expect(dropOut).toBeLessThan(riseIn)
  })
})