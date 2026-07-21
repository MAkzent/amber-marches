import { get } from 'svelte/store'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  activeDialogue,
  advanceDialogue,
  cameraMode,
  combatLive,
  completedDiscoveries,
  completeNearby,
  demoEndVisible,
  detectGraphicsTier,
  discoveries,
  dusk,
  markDialogueReady,
  nearbyDiscovery,
  notifyQuestPackCleared,
  objective,
  pulseCombat,
  questPhase,
  questRewardGlow,
  questSteps,
  resetWorld,
  tickCombatLive,
  weatherMode,
} from './worldState'

describe('demo quest', () => {
  beforeEach(resetWorld)

  it('starts at speak with the Defend Sunmere objective', () => {
    expect(get(questPhase)).toBe('speak')
    expect(get(objective)).toMatch(/Speak with Mara/i)
    expect(get(questSteps).map((step) => step.id)).toEqual(['speak', 'hunt', 'return'])
    expect(get(questSteps)[0]?.current).toBe(true)
  })

  it('frames Mara before dialogue advances, then moves to hunt', () => {
    const villager = discoveries.find((discovery) => discovery.id === 'villager')
    expect(villager).toBeTruthy()

    nearbyDiscovery.set(villager!)
    completeNearby()

    expect(get(activeDialogue)?.discovery.id).toBe('villager')
    expect(get(activeDialogue)?.ready).toBe(false)
    expect(get(cameraMode).kind).toBe('converse')
    expect(get(questPhase)).toBe('speak')

    advanceDialogue()
    expect(get(activeDialogue)?.lineIndex).toBe(0)

    markDialogueReady()
    expect(get(activeDialogue)?.ready).toBe(true)

    while (get(activeDialogue)) advanceDialogue()

    expect(get(questPhase)).toBe('hunt')
    expect(get(completedDiscoveries).has('villager')).toBe(true)
    expect(get(objective)).toMatch(/defeat the pack to the north/i)
    expect(get(activeDialogue)).toBeNull()
    expect(get(cameraMode).kind).toBe('explore')
  })

  it('does not keep Mara interactable during the hunt', () => {
    questPhase.set('hunt')
    nearbyDiscovery.set(discoveries[0]!)
    // updateNearby would clear her; completeNearby should also no-op once phase is hunt.
    completeNearby()
    expect(get(activeDialogue)).toBeNull()
    expect(get(questPhase)).toBe('hunt')
  })

  it('advances hunt → return when the pack is cleared', () => {
    questPhase.set('hunt')
    notifyQuestPackCleared()
    expect(get(questPhase)).toBe('return')
    expect(get(objective)).toMatch(/Return to Mara/i)
  })

  it('recognizes an early pack clear before the briefing', () => {
    expect(get(questPhase)).toBe('speak')
    notifyQuestPackCleared()

    expect(get(questPhase)).toBe('speak')
    expect(get(objective)).toMatch(/Tell Mara you cleared/i)
    expect(get(questSteps).find((step) => step.id === 'hunt')?.done).toBe(true)
    expect(get(questSteps).find((step) => step.id === 'return')?.current).toBe(true)

    nearbyDiscovery.set(discoveries[0]!)
    completeNearby()
    markDialogueReady()

    const firstLine = get(activeDialogue)?.discovery.dialogue?.[0]?.text ?? ''
    expect(firstLine).toMatch(/already faced/i)

    while (get(activeDialogue)) advanceDialogue()

    expect(get(questPhase)).toBe('done')
    expect(get(questRewardGlow)).toBe(true)
    expect(get(demoEndVisible)).toBe(true)
  })

  it('grants the demo-end reward after the return dialogue', () => {
    questPhase.set('return')
    nearbyDiscovery.set(discoveries[0]!)
    completeNearby()
    markDialogueReady()
    while (get(activeDialogue)) advanceDialogue()

    expect(get(questPhase)).toBe('done')
    expect(get(questRewardGlow)).toBe(true)
    expect(get(demoEndVisible)).toBe(true)
    expect(get(objective)).toMatch(/feel free to explore/i)
  })

  it('raises the Larkspur Watch banner into dusk and fireflies', () => {
    const tower = discoveries.find((discovery) => discovery.id === 'watchtower')
    expect(tower).toBeTruthy()

    nearbyDiscovery.set(tower!)
    completeNearby()

    expect(get(completedDiscoveries).has('watchtower')).toBe(true)
    expect(get(dusk)).toBe(true)
    expect(get(weatherMode)).toBe('fireflies')
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

describe('detectGraphicsTier', () => {
  it('treats coarse pointer as mobile', () => {
    expect(detectGraphicsTier({ matches: true }, 0, 1280)).toBe('mobile')
  })

  it('treats narrow touch viewports as mobile', () => {
    expect(detectGraphicsTier({ matches: false }, 5, 390)).toBe('mobile')
  })

  it('keeps desktop for fine pointer without touch', () => {
    expect(detectGraphicsTier({ matches: false }, 0, 1440)).toBe('desktop')
  })
})
