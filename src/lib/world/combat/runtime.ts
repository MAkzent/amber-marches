import { writable } from 'svelte/store'
import type { CircleCollider } from '../collision'
import { resetLootRuntime } from '../loot/runtime'
import type { Combatant, DamageEvent } from './types'

const MAX_DAMAGE_EVENTS = 32
const DAMAGE_EVENT_LIFETIME = 1.05

let combatants: Combatant[] = []
let nextDamageEventId = 1

export const damageEvents: DamageEvent[] = []

export type CombatHudEnemy = {
  id: string
  name: string
  health: number
  maxHealth: number
  alive: boolean
  screenX: number
  screenY: number
  onScreen: boolean
  focused: boolean
}

export type CombatHudState = {
  enemies: CombatHudEnemy[]
  damage: DamageEvent[]
}

export const combatHud = writable<CombatHudState>({ enemies: [], damage: [] })
export type CombatAudioKind = 'swing' | 'impact' | 'defeat'
export const combatAudioEvent = writable({
  serial: 0,
  kind: 'swing' as CombatAudioKind,
  hits: 0,
})
let combatAudioSerial = 0

/** Cross-component input queue. The party consumes requests once per frame. */
export const abilityInput = {
  requestedSlots: [] as number[],
}

/** Lightweight impulses shared by combat actors, camera and post effects. */
export const combatImpact = {
  serial: 0,
  x: 0,
  z: 0,
  strength: 0,
  hitStop: 0,
  resetSerial: 0,
}

export const combatFocus = {
  targetId: null as string | null,
}

export function setCombatants(next: Combatant[]) {
  combatants = next
}

export function getCombatants() {
  return combatants
}

export function setCombatFocusTarget(targetId: string | null) {
  combatFocus.targetId = targetId
}

export function getLivingEnemyColliders(): CircleCollider[] {
  return combatants
    .filter((combatant) => combatant.faction === 'enemy' && combatant.alive)
    .map(({ x, z, radius }) => ({ x, z, radius }))
}

export function nextDamageId() {
  return nextDamageEventId++
}

export function pushDamageEvents(events: DamageEvent[]) {
  for (const event of events) {
    if (damageEvents.length >= MAX_DAMAGE_EVENTS) damageEvents.shift()
    damageEvents.push(event)
  }
  if (events.length) {
    emitCombatAudio(
      events.some((event) => event.defeated) ? 'defeat' : 'impact',
      events.length,
    )
  }
}

export function emitCombatAudio(kind: CombatAudioKind, hits = 0) {
  combatAudioEvent.set({ serial: ++combatAudioSerial, kind, hits })
}

export function tickDamageEvents(delta: number) {
  for (let index = damageEvents.length - 1; index >= 0; index -= 1) {
    damageEvents[index].age += delta
    if (damageEvents[index].age >= DAMAGE_EVENT_LIFETIME) damageEvents.splice(index, 1)
  }
}

export function publishCombatHud(enemies: CombatHudEnemy[]) {
  combatHud.set({
    enemies: enemies.map((enemy) => ({ ...enemy })),
    damage: damageEvents.map((event) => ({ ...event })),
  })
}

/** Drop overworld nameplates / floaters — used when battle owns the field or the pack is cleared. */
export function clearCombatHudVitals() {
  combatHud.set({ enemies: [], damage: [] })
}

export function requestAbilitySlot(slot: number) {
  if (!abilityInput.requestedSlots.includes(slot)) abilityInput.requestedSlots.push(slot)
}

export function consumeAbilitySlots() {
  return abilityInput.requestedSlots.splice(0)
}

export function pushCombatImpact(x: number, z: number, strength = 1) {
  combatImpact.serial += 1
  combatImpact.x = x
  combatImpact.z = z
  combatImpact.strength = strength
  combatImpact.hitStop = Math.max(combatImpact.hitStop, 0.045 * strength)
}

/** Scale only actor/combat simulation; camera and particles keep moving through the pause. */
export function combatDelta(delta: number) {
  if (combatImpact.hitStop <= 0) return delta
  combatImpact.hitStop = Math.max(0, combatImpact.hitStop - delta)
  return 0
}

export function resetCombatRuntime() {
  damageEvents.length = 0
  abilityInput.requestedSlots.length = 0
  combatImpact.serial = 0
  combatImpact.strength = 0
  combatImpact.hitStop = 0
  combatImpact.resetSerial += 1
  combatFocus.targetId = null
  for (const combatant of combatants) {
    combatant.health = combatant.maxHealth
    combatant.alive = true
  }
  resetLootRuntime()
  combatHud.set({ enemies: [], damage: [] })
}
