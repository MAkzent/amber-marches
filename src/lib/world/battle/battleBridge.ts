import { get, writable } from 'svelte/store'
import {
  hexBattleDriver,
  type BattlePhase,
  type MirrorUnit,
} from '../../battle'
import {
  cameraMode,
  introVisible,
  notifyQuestPackCleared,
  partyLive,
  playerLive,
  playerPosition,
  reducedMotion,
} from '../worldState'
import { spawnLootBurst } from '../loot/runtime'
import { walkHeight } from '../data/sunmereVale'
import { clearCombatHudVitals, combatImpact } from '../combat'
import { PASSIVE_ENEMIES } from '../combat/encounter'
import { computeBlockedHexes } from './boardTerrain'
import { SUNMERE_BATTLE_MAP } from './encounterMap'
import { placementHighlight } from './placementHighlight'

/** Authored pack centroid — north forest past Silverrun (−Z; matches PASSIVE_ENEMIES). */
export const ENCOUNTER_ORIGIN = SUNMERE_BATTLE_MAP.origin
export const ENCOUNTER_TRIGGER_RADIUS = SUNMERE_BATTLE_MAP.triggerRadius

/** Natural standing Y; elevation never changes tactical rules or board shape. */
export function battleGroundY(x: number, z: number): number {
  return walkHeight(x, z)
}

/** After leave, require this much separation before re-triggering. */
const REENTRY_CLEAR_RADIUS = ENCOUNTER_TRIGGER_RADIUS + 2.4

/** Camera/veil lead before explore → battle actor swap. */
const PRELUDE_DURATION = 0.3
/** Seconds for the slowest unit to finish walking onto its hex. */
const MARCH_DURATION = 1.1
const MARCH_STAGGER = 0.08
/** Full stage settle from trigger through march-in. */
const STAGE_BLEND_DURATION = PRELUDE_DURATION + MARCH_DURATION + MARCH_STAGGER * 3
/** Brief result hold, then dissolve the battle actors before returning to world sprites. */
const RESOLVE_HOLD_DURATION = 0.42
const ACTOR_FADE_DURATION = 0.55
/** Soft release after settle — board/veil ease out before explore actors return. */
const EXIT_BLEND_DURATION = 0.75

export type BattleHudSnapshot = {
  phase: BattlePhase
  /** True only when formation is ready (march-in finished). */
  placing: boolean
  fighting: boolean
  over: boolean
  winner: 'hero' | 'enemy' | null
  /** Prelude or march-in — camera settling, units walking on. */
  entering: boolean
  /**
   * 0→1 stage settle from encounter trigger through march-in.
   * Full at placing / fighting; drives drama veil, vignette, ground wash.
   * Eases out during soft exit.
   */
  stageBlend: number
  /** Won encounter — overworld pack sprites + nameplates stay gone. */
  packCleared: boolean
}

export type MarchPose = {
  id: string
  x: number
  z: number
  walking: boolean
  /** 0..1 overall march progress for this unit. */
  progress: number
}

export type BattleVital = {
  id: string
  name: string
  team: 'hero' | 'enemy'
  hp: number
  maxHp: number
  alive: boolean
  screenX: number
  screenY: number
  onScreen: boolean
}

export type BattleDamage = {
  id: number
  amount: number
  defeated: boolean
  screenX: number
  screenY: number
  age: number
}

export const battleHud = writable<BattleHudSnapshot>({
  phase: 'idle',
  placing: false,
  fighting: false,
  over: false,
  winner: null,
  entering: false,
  stageBlend: 0,
  packCleared: false,
})

/** Mirrored units for any DOM consumers (HP bars). */
export const battleMirror = writable<MirrorUnit[]>([])

/** Screen-projected nameplates above battle units. */
export const battleVitals = writable<BattleVital[]>([])
export const battleDamage = writable<BattleDamage[]>([])

type MarchUnit = {
  id: string
  fromX: number
  fromZ: number
  toX: number
  toZ: number
  delay: number
}

let armed = true
let settleTimer = 0
let lootSpawned = false
let encounterCleared = false
let resetSerial = combatImpact.resetSerial
let marchElapsed = 0
let marchUnits: MarchUnit[] = []
let marchActive = false
/** Time since enterBattle (or exit blend countdown). */
let stageElapsed = 0
let preludeActive = false
/** True after prelude — explore actors hidden, battle sprites marching. */
let handoffDone = false
/** Soft exit: board still up while camera releases. */
let exiting = false
let exitElapsed = 0
let exitWon = false
let resolutionStarted = false
let partyReturning = false
let lootCollectable = true

export function isEncounterCleared() {
  return encounterCleared
}

export function isPartyReturning() {
  return partyReturning
}

export function isLootCollectable() {
  return lootCollectable
}

export function notifyPartyReturnComplete() {
  if (!partyReturning) return
  partyReturning = false
  lootCollectable = true
  publishHud()
}

export function isBattleEntering() {
  return preludeActive || marchActive
}

/** Prelude finished — battle sprites own the field. */
export function isBattleHandoffDone() {
  return handoffDone && !exiting
}

/**
 * Overworld enemy nameplates — explore only, and never after a cleared pack.
 * Publishers must clear combatHud whenever this is false.
 */
export function shouldShowOverworldEnemyVitals() {
  return !isBattleActive() && !encounterCleared
}

/** Battle cards stay mounted through the result hold and actor dissolve. */
export function shouldRenderBattleUnits() {
  return hexBattleDriver.isActive() && handoffDone && !exiting
}

export function getBattleActorOpacity() {
  if (!resolutionStarted) return 1
  const fadeElapsed = Math.max(0, settleTimer - RESOLVE_HOLD_DURATION)
  return 1 - Math.min(1, fadeElapsed / ACTOR_FADE_DURATION)
}

/**
 * Hex battle floating vitals — after actor handoff until soft exit begins.
 * Publishers must clear battleVitals whenever this is false.
 */
export function shouldShowBattleUnitVitals() {
  return isBattleHandoffDone() && !hexBattleDriver.getState().over
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Continuous 0..1 from trigger → formation-ready (and held through fight). */
function computeStageBlend() {
  if (exiting) {
    const t = Math.min(1, exitElapsed / EXIT_BLEND_DURATION)
    return 1 - easeInOutCubic(t)
  }
  if (!hexBattleDriver.isActive()) return 0
  if (!preludeActive && !marchActive) return 1
  const t = Math.min(1, stageElapsed / STAGE_BLEND_DURATION)
  return easeInOutCubic(t)
}

function publishHud() {
  const state = hexBattleDriver.getState()
  const entering = preludeActive || marchActive
  battleHud.set({
    // Keep victory/defeat through soft exit so the board can fade out cleanly.
    phase: state.phase,
    placing: !exiting && state.phase === 'placing' && !marchActive && !preludeActive,
    fighting: !exiting && state.phase === 'fighting',
    over: state.over,
    winner: state.winner,
    entering: !exiting && entering,
    stageBlend: computeStageBlend(),
    packCleared: encounterCleared,
  })
}

/** Clear both floating-vital stores so idle handoff cannot resurrect stale plates. */
function clearAllFloatingVitals() {
  battleVitals.set([])
  battleDamage.set([])
  clearCombatHudVitals()
}

export function isBattleActive() {
  return hexBattleDriver.isActive() || exiting || partyReturning
}

/** Lock locomotion for the full stage lifetime (including settle + soft exit). */
export function isBattleMovementLocked() {
  return exiting || partyReturning || hexBattleDriver.isActive()
}

/**
 * Hide explore party / world pack only after prelude handoff
 * (and through settle / soft exit).
 */
export function isBattleActorsHidden() {
  if (partyReturning) return false
  if (exiting) return true
  return hexBattleDriver.isActive() && handoffDone
}

function beginMarchIn() {
  const snapshot = hexBattleDriver.mirrorSnapshot()
  const enemyStarts = new Map(PASSIVE_ENEMIES.map((e) => [e.id, { x: e.x, z: e.z }]))
  marchUnits = []
  marchElapsed = 0
  marchActive = true

  let heroIndex = 0
  let enemyIndex = 0
  for (const unit of snapshot) {
    const toX = unit.x
    const toZ = unit.z
    let fromX = toX
    let fromZ = toZ
    let delay = 0

    if (unit.team === 'hero') {
      const slot = partyLive[heroIndex] ?? partyLive[0]
      fromX = slot.x
      fromZ = slot.z
      delay = heroIndex * MARCH_STAGGER
      heroIndex += 1
    } else {
      const start = enemyStarts.get(unit.id)
      if (start) {
        fromX = start.x
        fromZ = start.z
      } else {
        fromX = toX + 1.8
        fromZ = toZ + 0.4
      }
      delay = 0.08 + enemyIndex * MARCH_STAGGER
      enemyIndex += 1
    }

    marchUnits.push({ id: unit.id, fromX, fromZ, toX, toZ, delay })
  }
}

/** Presentation poses during march-in (overrides hex snap). */
export function getMarchPoses(): MarchPose[] {
  if (!marchActive) return []
  return marchUnits.map((unit) => {
    const local = Math.max(0, marchElapsed - unit.delay)
    const duration = Math.max(0.35, MARCH_DURATION - unit.delay * 0.35)
    const progress = Math.min(1, local / duration)
    const t = easeOutCubic(progress)
    const x = unit.fromX + (unit.toX - unit.fromX) * t
    const z = unit.fromZ + (unit.toZ - unit.fromZ) * t
    return {
      id: unit.id,
      x,
      z,
      walking: progress > 0 && progress < 1,
      progress,
    }
  })
}

function tickMarch(dt: number) {
  if (!marchActive) return
  marchElapsed += dt
  const allDone = marchUnits.every((unit) => {
    const local = Math.max(0, marchElapsed - unit.delay)
    const duration = Math.max(0.35, MARCH_DURATION - unit.delay * 0.35)
    return local >= duration
  })
  if (allDone) {
    marchActive = false
    marchUnits = []
  }
}

/**
 * Keep the explore party on their final battle hexes (including fallen heroes).
 * Open-world sprites simply reappear alive there — no edge warp / reform.
 */
function applyExitPartyFormation() {
  const heroes = hexBattleDriver
    .mirrorSnapshot()
    .filter((unit) => unit.team === 'hero')
  if (!heroes.length) {
    const edgeX = ENCOUNTER_ORIGIN.x + 4.5
    const edgeZ = ENCOUNTER_ORIGIN.z + 5.5
    playerLive.x = edgeX
    playerLive.z = edgeZ
    playerPosition.set([edgeX, edgeZ])
    return
  }

  for (let i = 0; i < partyLive.length; i += 1) {
    const unit = heroes[i]
    if (!unit) continue
    const y = battleGroundY(unit.x, unit.z)
    partyLive[i].x = unit.x
    partyLive[i].y = y
    partyLive[i].z = unit.z
  }

  const leader = heroes[0]
  playerLive.x = leader.x
  playerLive.z = leader.z
  playerPosition.set([leader.x, leader.z])
}

function finishExit() {
  if (exitWon) {
    encounterCleared = true
    notifyQuestPackCleared()
  }
  // Transfer final hexes only after the battle cards and stage have faded away.
  if (hexBattleDriver.isActive()) applyExitPartyFormation()
  partyReturning = true
  hexBattleDriver.clear()
  battleMirror.set([])
  clearAllFloatingVitals()
  marchActive = false
  marchUnits = []
  marchElapsed = 0
  preludeActive = false
  handoffDone = false
  stageElapsed = 0
  exiting = false
  exitElapsed = 0
  resolutionStarted = false
  if (get(cameraMode).kind !== 'explore') {
    cameraMode.set({ kind: 'explore' })
  }
  armed = false
  publishHud()
}

export function enterBattle() {
  if (hexBattleDriver.isActive() || exiting || partyReturning) return
  lootSpawned = false
  lootCollectable = false
  resolutionStarted = false
  settleTimer = 0
  stageElapsed = 0
  preludeActive = true
  handoffDone = false
  exiting = false
  exitElapsed = 0
  introVisible.set(false)
  const origin = { ...SUNMERE_BATTLE_MAP.origin }
  const blocked = computeBlockedHexes(
    origin,
    SUNMERE_BATTLE_MAP.radius,
    SUNMERE_BATTLE_MAP.hexSize,
  )
  hexBattleDriver.buildEncounter({
    origin,
    seed: 17,
    boardRadius: SUNMERE_BATTLE_MAP.radius,
    hexSize: SUNMERE_BATTLE_MAP.hexSize,
    blocked,
    heroDeploy: SUNMERE_BATTLE_MAP.heroDeploy,
    enemyDeploy: SUNMERE_BATTLE_MAP.enemyDeploy,
  })
  if (get(reducedMotion)) {
    preludeActive = false
    handoffDone = true
    beginMarchIn()
    tickMarch(MARCH_DURATION + MARCH_STAGGER * 4)
    stageElapsed = STAGE_BLEND_DURATION
  }
  // Camera + veil lead; march waits for prelude handoff.
  cameraMode.set({
    kind: 'battle',
    focus: [ENCOUNTER_ORIGIN.x, ENCOUNTER_ORIGIN.z],
  })
  battleMirror.set(hexBattleDriver.mirrorSnapshot())
  clearAllFloatingVitals()
  publishHud()
}

export function requestStartBattle() {
  if (preludeActive || marchActive) return
  if (!hexBattleDriver.isPlacing()) return
  hexBattleDriver.setRunning(true)
  publishHud()
}

function beginSoftExit() {
  const won = hexBattleDriver.getState().phase === 'victory'
  exitWon = won
  exiting = true
  exitElapsed = 0
  // Release the camera first; final world positions transfer only after the stage is gone.
  cameraMode.set({ kind: 'explore' })
  clearAllFloatingVitals()
  publishHud()
}

export function resetBattleBridge() {
  hexBattleDriver.clear()
  battleMirror.set([])
  clearAllFloatingVitals()
  armed = true
  settleTimer = 0
  lootSpawned = false
  lootCollectable = true
  encounterCleared = false
  marchActive = false
  marchUnits = []
  marchElapsed = 0
  stageElapsed = 0
  preludeActive = false
  handoffDone = false
  exiting = false
  exitElapsed = 0
  resolutionStarted = false
  partyReturning = false
  placementHighlight.set(null)
  publishHud()
  if (get(cameraMode).kind === 'battle') {
    cameraMode.set({ kind: 'explore' })
  }
}

/**
 * Call once per frame from the battle scene host.
 * Handles proximity enter, prelude, march-in, sim advance, settle → soft exit.
 */
export function tickBattleBridge(dt: number, onEvents?: (events: import('../../battle').SimEvent[]) => void) {
  if (combatImpact.resetSerial !== resetSerial) {
    resetSerial = combatImpact.resetSerial
    resetBattleBridge()
  }

  hexBattleDriver.configure(onEvents ?? null)

  if (exiting) {
    exitElapsed += dt
    publishHud()
    if (exitElapsed >= EXIT_BLEND_DURATION) {
      finishExit()
    }
    return
  }

  if (!hexBattleDriver.isActive()) {
    if (encounterCleared) return
    const dist = Math.hypot(playerLive.x - ENCOUNTER_ORIGIN.x, playerLive.z - ENCOUNTER_ORIGIN.z)
    if (!armed) {
      if (dist > REENTRY_CLEAR_RADIUS) armed = true
      return
    }
    if (
      dist <= ENCOUNTER_TRIGGER_RADIUS &&
      get(cameraMode).kind !== 'converse' &&
      !get(introVisible)
    ) {
      enterBattle()
    }
    return
  }

  stageElapsed += dt

  if (preludeActive) {
    if (stageElapsed >= PRELUDE_DURATION) {
      preludeActive = false
      handoffDone = true
      beginMarchIn()
    }
    battleMirror.set(hexBattleDriver.mirrorSnapshot())
    publishHud()
    return
  }

  tickMarch(dt)
  // Hold the sim clock until everyone has walked on.
  if (!marchActive) {
    hexBattleDriver.advance(dt)
  }
  battleMirror.set(hexBattleDriver.mirrorSnapshot())
  publishHud()

  const state = hexBattleDriver.getState()
  if (state.phase === 'victory' || state.phase === 'defeat') {
    if (!resolutionStarted) {
      resolutionStarted = true
      placementHighlight.set(null)
      clearAllFloatingVitals()
      if (!lootSpawned && state.phase === 'victory') {
        for (const drop of hexBattleDriver.defeatedEnemyPositions()) {
          spawnLootBurst(drop.x, drop.z, drop.id)
        }
        lootSpawned = true
      }
    }
    settleTimer += dt
    if (settleTimer >= RESOLVE_HOLD_DURATION + ACTOR_FADE_DURATION) {
      beginSoftExit()
    }
  }
}

export function battleFocusHeight() {
  return walkHeight(ENCOUNTER_ORIGIN.x, ENCOUNTER_ORIGIN.z)
}

export function publishBattleVitals(vitals: BattleVital[]) {
  battleVitals.set(vitals)
}

export function publishBattleDamage(damage: BattleDamage[]) {
  battleDamage.set(damage)
}
