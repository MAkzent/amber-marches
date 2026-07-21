/**
 * Slim continuous-time hex battle sim (auto-attack subset of gambit hexproto).
 * Renderer-free. Drive with FIXED_DT; consume SimEvent[] + fractionalHexOf.
 */

import { findHexPath, hexDistance, hexKey } from './hex'
import type { Hex } from './hex'
import type {
  HexUnit,
  SimConfig,
  SimEvent,
  SimView,
  UnitSpawn,
} from './types'

export const FIXED_DT = 1 / 60
const REPATH_WAIT = 0.15
const FLIGHT_BASE = 0.06
const FLIGHT_PER_HEX = 0.05
/** TFT-style chase: drop latch after this many hexes without reaching range. */
const CHASE_MOVES_MAX = 2

export interface HexSim {
  readonly units: HexUnit[]
  readonly time: number
  step(dt: number): SimEvent[]
  isOver(): boolean
  fractionalHexOf(unit: HexUnit): { q: number; r: number }
  addUnit(spawn: UnitSpawn): HexUnit
  removeUnit(id: string): void
  relocateUnit(id: string, to: Hex): boolean
  isFree(h: Hex): boolean
  view: SimView
}

interface Payload {
  impactAt: number
  casterId: string
  targetId: string
  amount: number
}

function makeUnit(s: UnitSpawn): HexUnit {
  return {
    id: s.id,
    actorId: s.actorId,
    team: s.team,
    hex: { ...s.hex },
    hp: s.stats.maxHp,
    alive: true,
    stats: { ...s.stats },
    activity: { kind: 'idle' },
    cooldowns: {},
    repathWait: 0,
    chaseMoves: 0,
  }
}

function makeView(
  units: HexUnit[],
  time: () => number,
  isPassable: (h: Hex, unit: HexUnit) => boolean,
): SimView {
  const living = () => units.filter((u) => u.alive)
  return {
    isPassable,
    get time() {
      return time()
    },
    unitsOf: (team) => living().filter((u) => u.team === team),
    enemiesOf: (unit) => living().filter((u) => u.team !== unit.team),
    nearestEnemy(unit) {
      let best: HexUnit | null = null
      let bestDist = Infinity
      for (const e of this.enemiesOf(unit)) {
        const d = hexDistance(unit.hex, e.hex)
        if (
          d < bestDist ||
          (d === bestDist &&
            best &&
            (e.hp < best.hp || (e.hp === best.hp && e.id < best.id)))
        ) {
          best = e
          bestDist = d
        }
      }
      return best
    },
  }
}

export function createSim(spawns: UnitSpawn[], config: SimConfig): HexSim {
  const units: HexUnit[] = spawns.map(makeUnit)
  let time = 0
  const byId = new Map(units.map((u) => [u.id, u]))
  const staticBlocked = new Set((config.blocked ?? []).map(hexKey))
  const occupied = new Map<string, string>()
  const payloads: Payload[] = []

  function claimCell(h: Hex, id: string): void {
    occupied.set(hexKey(h), id)
  }

  function releaseCell(h: Hex, id: string): void {
    const key = hexKey(h)
    if (occupied.get(key) === id) occupied.delete(key)
  }

  function inBoard(h: Hex): boolean {
    return hexDistance(h, { q: 0, r: 0 }) <= config.boardRadius
  }

  function isBlocked(h: Hex, self: HexUnit): boolean {
    if (staticBlocked.has(hexKey(h))) return true
    const owner = occupied.get(hexKey(h))
    return owner !== undefined && owner !== self.id
  }

  function isPlanBlocked(h: Hex, self: HexUnit): boolean {
    if (staticBlocked.has(hexKey(h))) return true
    const owner = occupied.get(hexKey(h))
    if (owner === undefined || owner === self.id) return false
    const other = byId.get(owner)
    return !(other?.team === self.team && other.activity.kind === 'moving')
  }

  for (const u of units) {
    if (staticBlocked.has(hexKey(u.hex))) {
      throw new Error(`hex sim: spawn '${u.id}' on blocked cell ${hexKey(u.hex)}`)
    }
    if (occupied.has(hexKey(u.hex))) {
      throw new Error(`hex sim: spawn '${u.id}' on occupied cell ${hexKey(u.hex)}`)
    }
    claimCell(u.hex, u.id)
  }

  const view = makeView(units, () => time, (h, u) => inBoard(h) && !isBlocked(h, u))

  function clearEngageLatch(unit: HexUnit): void {
    unit.engageTargetId = undefined
    unit.chaseMoves = 0
  }

  function kill(unit: HexUnit, events: SimEvent[]): void {
    if (!unit.alive) return
    unit.alive = false
    unit.activity = { kind: 'idle' }
    releaseCell(unit.hex, unit.id)
    events.push({ type: 'die', at: time, unitId: unit.id })
  }

  function relocate(unit: HexUnit, to: Hex): void {
    releaseCell(unit.hex, unit.id)
    unit.hex = { ...to }
    unit.activity = { kind: 'idle' }
    clearEngageLatch(unit)
    claimCell(to, unit.id)
  }

  function startMoveToward(unit: HexUnit, goal: Hex): boolean {
    const path = findHexPath(unit.hex, goal, (h) => isPlanBlocked(h, unit), config.boardRadius)
    const next = path.length > 1 ? path[1] : null
    if (!next || isBlocked(next, unit)) {
      unit.repathWait = REPATH_WAIT
      return false
    }
    const from = { ...unit.hex }
    claimCell(next, unit.id)
    releaseCell(from, unit.id)
    unit.hex = { ...next }
    unit.activity = {
      kind: 'moving',
      from,
      to: { ...next },
      t: 0,
      duration: unit.stats.secondsPerHex,
    }
    return true
  }

  function startAttack(unit: HexUnit, target: HexUnit, events: SimEvent[]): void {
    unit.cooldowns.attack = unit.stats.attackCooldownSeconds
    unit.activity = { kind: 'attacking', targetId: target.id, elapsed: 0 }
    events.push({
      type: 'attackStart',
      at: time,
      unitId: unit.id,
      targetId: target.id,
      projectile: unit.stats.attackRangeHexes > 1,
    })
  }

  function fire(unit: HexUnit, events: SimEvent[]): void {
    if (unit.activity.kind !== 'attacking') return
    const target = byId.get(unit.activity.targetId)
    if (!target?.alive) return
    if (
      unit.stats.attackRangeHexes === 1 &&
      hexDistance(unit.hex, target.hex) > unit.stats.attackRangeHexes
    ) return

    const amount = unit.stats.attackDamage
    if (unit.stats.attackRangeHexes > 1) {
      const flight = FLIGHT_BASE + FLIGHT_PER_HEX * hexDistance(unit.hex, target.hex)
      events.push({
        type: 'projectile',
        at: time,
        unitId: unit.id,
        targetId: target.id,
        flightSeconds: flight,
      })
      payloads.push({
        impactAt: time + flight,
        casterId: unit.id,
        targetId: target.id,
        amount,
      })
    } else {
      target.hp -= amount
      events.push({
        type: 'hit',
        at: time,
        unitId: unit.id,
        targetId: target.id,
        amount,
      })
      if (target.hp <= 0) kill(target, events)
    }
  }

  function decideAndAct(unit: HexUnit, events: SimEvent[]): void {
    const intent = config.decide(unit, view)
    if (intent.kind === 'idle') {
      unit.repathWait = REPATH_WAIT
      return
    }

    const latched = unit.engageTargetId ? byId.get(unit.engageTargetId) : undefined
    const keepLatch =
      latched?.alive &&
      (hexDistance(unit.hex, latched.hex) <= unit.stats.attackRangeHexes ||
        unit.chaseMoves < CHASE_MOVES_MAX)

    let target: HexUnit | undefined
    if (keepLatch) {
      target = latched
    } else {
      target = byId.get(intent.targetId)
      unit.chaseMoves = 0
    }

    if (!target?.alive) {
      clearEngageLatch(unit)
      unit.repathWait = REPATH_WAIT
      return
    }

    unit.engageTargetId = target.id
    const range = unit.stats.attackRangeHexes

    if (hexDistance(unit.hex, target.hex) <= range) {
      unit.chaseMoves = 0
      if ((unit.cooldowns.attack ?? 0) > 0) return
      startAttack(unit, target, events)
      return
    }

    const moved = startMoveToward(unit, target.hex)
    if (moved) unit.chaseMoves += 1
    else clearEngageLatch(unit)
  }

  function step(dt: number): SimEvent[] {
    const events: SimEvent[] = []
    time += dt

    for (const p of payloads
      .filter((p) => p.impactAt <= time)
      .sort((a, b) => a.impactAt - b.impactAt)) {
      const caster = byId.get(p.casterId)
      const target = byId.get(p.targetId)
      if (!caster || !target?.alive) continue
      target.hp -= p.amount
      events.push({
        type: 'hit',
        at: p.impactAt,
        unitId: caster.id,
        targetId: target.id,
        amount: p.amount,
      })
      if (target.hp <= 0) kill(target, events)
    }
    for (let i = payloads.length - 1; i >= 0; i--) {
      if (payloads[i].impactAt <= time) payloads.splice(i, 1)
    }

    for (const unit of units) {
      if (!unit.alive) continue

      for (const key of Object.keys(unit.cooldowns)) {
        unit.cooldowns[key] = Math.max(0, unit.cooldowns[key] - dt)
      }
      if (unit.repathWait > 0) unit.repathWait -= dt

      if (unit.activity.kind === 'moving') {
        unit.activity.t += dt
        if (unit.activity.t >= unit.activity.duration) {
          unit.activity = { kind: 'idle' }
        }
      } else if (unit.activity.kind === 'attacking') {
        const windup = unit.stats.attackWindupSeconds
        const duration = unit.stats.attackDurationSeconds
        const before = unit.activity.elapsed
        unit.activity.elapsed += dt
        if (before < windup && unit.activity.elapsed >= windup) {
          fire(unit, events)
          if (unit.activity.kind === 'attacking') unit.activity.fired = true
        }
        if (unit.activity.kind === 'attacking' && unit.activity.elapsed >= duration) {
          unit.activity = { kind: 'idle' }
        }
      }

      if (unit.alive && unit.activity.kind === 'idle' && unit.repathWait <= 0) {
        decideAndAct(unit, events)
      }
    }

    return events
  }

  return {
    units,
    get time() {
      return time
    },
    step,
    isOver() {
      const heroes = units.some((u) => u.alive && u.team === 'hero')
      const enemies = units.some((u) => u.alive && u.team === 'enemy')
      return !heroes || !enemies
    },
    addUnit(spawn) {
      if (byId.has(spawn.id)) throw new Error(`hex sim: duplicate unit id ${spawn.id}`)
      if (staticBlocked.has(hexKey(spawn.hex)) || occupied.has(hexKey(spawn.hex))) {
        throw new Error(`hex sim: cell ${hexKey(spawn.hex)} unavailable`)
      }
      const unit = makeUnit(spawn)
      units.push(unit)
      byId.set(unit.id, unit)
      claimCell(unit.hex, unit.id)
      return unit
    },
    removeUnit(id) {
      const unit = byId.get(id)
      if (!unit) return
      releaseCell(unit.hex, unit.id)
      unit.alive = false
      byId.delete(id)
      const index = units.indexOf(unit)
      if (index >= 0) units.splice(index, 1)
    },
    relocateUnit(id, to) {
      const unit = byId.get(id)
      if (!unit || !unit.alive) return false
      if (!inBoard(to) || isBlocked(to, unit)) return false
      relocate(unit, to)
      return true
    },
    isFree(h) {
      return !occupied.has(hexKey(h))
    },
    fractionalHexOf(unit) {
      if (unit.activity.kind === 'moving') {
        const p = Math.min(1, unit.activity.t / unit.activity.duration)
        return {
          q: unit.activity.from.q + (unit.activity.to.q - unit.activity.from.q) * p,
          r: unit.activity.from.r + (unit.activity.to.r - unit.activity.from.r) * p,
        }
      }
      return { ...unit.hex }
    },
    view,
  }
}
