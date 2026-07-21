import {
  createSim,
  defaultDecide,
  FIXED_DT,
  hexDistance,
  hexKey,
  type Hex,
  type HexSim,
  type HexUnit,
  type SimEvent,
  type UnitSpawn,
} from './hexsim'
import {
  actorDisplayName,
  BOARD_RADIUS,
  buildDefaultSpawns,
  ENEMY_DEPLOY_HEXES,
  HERO_DEPLOY_HEXES,
  resolveDeploySlots,
} from './spawns'
import {
  fractionalHexToWorldXZ,
  WORLD_HEX_SIZE,
  type BoardOrigin,
} from './projection'

export type BattlePhase = 'idle' | 'placing' | 'fighting' | 'victory' | 'defeat'

export type MirrorUnit = {
  id: string
  actorId: string
  /** Authored display name from spawn defs. */
  name: string
  team: 'hero' | 'enemy'
  hex: Hex
  x: number
  z: number
  hp: number
  maxHp: number
  attackRangeHexes: number
  alive: boolean
  activity: HexUnit['activity']
}

export type BattleDriverState = {
  phase: BattlePhase
  running: boolean
  over: boolean
  winner: 'hero' | 'enemy' | null
}

export type BattleEncounterDef = {
  origin: BoardOrigin
  seed?: number
  spawns?: UnitSpawn[]
  boardRadius?: number
  hexSize?: number
  /** Terrain / obstacle hexes omitted from the board and pathing. */
  blocked?: Hex[]
  heroDeploy?: readonly Hex[]
  enemyDeploy?: readonly Hex[]
}

export type EventHandler = (events: SimEvent[]) => void

/**
 * Thin host for the hex sim — gambit HexProdDriver essentials without Phaser.
 * Placement = live sim, clock stopped. Start = setRunning(true).
 */
export class HexBattleDriver {
  private sim: HexSim | null = null
  private origin: BoardOrigin = { x: 0, z: 0 }
  private hexSize = WORLD_HEX_SIZE
  private boardRadius = BOARD_RADIUS
  private running = false
  private accumulator = 0
  private settled: 'victory' | 'defeat' | null = null
  private dragUnitId: string | null = null
  private onEvents: EventHandler | null = null
  private seed = 1
  private blocked: Hex[] = []
  private heroDeploy: Hex[] = []
  private enemyDeploy: Hex[] = []
  private heroDeployKeys = new Set<string>()

  configure(handler: EventHandler | null) {
    this.onEvents = handler
  }

  buildEncounter(def: BattleEncounterDef) {
    this.origin = { ...def.origin }
    this.hexSize = def.hexSize ?? WORLD_HEX_SIZE
    this.boardRadius = def.boardRadius ?? BOARD_RADIUS
    this.seed = def.seed ?? 1
    this.running = false
    this.accumulator = 0
    this.settled = null
    this.dragUnitId = null
    this.blocked = (def.blocked ?? []).map((h) => ({ ...h }))
    const preferredHeroDeploy = def.heroDeploy ?? HERO_DEPLOY_HEXES
    const preferredEnemyDeploy = def.enemyDeploy ?? ENEMY_DEPLOY_HEXES

    // Placement UI + drag targets: preferred deploy minus terrain blocks.
    this.heroDeploy = resolveDeploySlots(
      preferredHeroDeploy,
      preferredHeroDeploy.length,
      'hero',
      this.blocked,
      this.boardRadius,
    )
    this.enemyDeploy = resolveDeploySlots(
      preferredEnemyDeploy,
      preferredEnemyDeploy.length,
      'enemy',
      this.blocked,
      this.boardRadius,
    )
    this.heroDeployKeys = new Set(this.heroDeploy.map((h) => hexKey(h)))

    const spawns =
      def.spawns ??
      buildDefaultSpawns({
        blocked: this.blocked,
        boardRadius: this.boardRadius,
        heroDeploy: preferredHeroDeploy,
        enemyDeploy: preferredEnemyDeploy,
      })
    this.sim = createSim(spawns, {
      boardRadius: this.boardRadius,
      seed: this.seed,
      decide: defaultDecide,
      blocked: this.blocked,
    })
  }

  clear() {
    this.sim = null
    this.running = false
    this.accumulator = 0
    this.settled = null
    this.dragUnitId = null
    this.blocked = []
    this.heroDeploy = []
    this.enemyDeploy = []
    this.heroDeployKeys.clear()
  }

  getOrigin() {
    return this.origin
  }

  getHexSize() {
    return this.hexSize
  }

  getBoardRadius() {
    return this.boardRadius
  }

  getBlockedCells(): Hex[] {
    return this.blocked.map((h) => ({ ...h }))
  }

  getHeroDeployCells(): Hex[] {
    return this.heroDeploy.map((h) => ({ ...h }))
  }

  getEnemyDeployCells(): Hex[] {
    return this.enemyDeploy.map((h) => ({ ...h }))
  }

  /** Open, traversable hero deploy hex (terrain-aware). */
  isHeroDeployHex(hex: Hex): boolean {
    return this.heroDeployKeys.has(hexKey(hex))
  }

  isActive() {
    return this.sim !== null
  }

  isPlacing() {
    return this.sim !== null && !this.running && this.settled === null && !this.sim.isOver()
  }

  isFighting() {
    return this.sim !== null && this.running && this.settled === null
  }

  getState(): BattleDriverState {
    if (!this.sim) {
      return { phase: 'idle', running: false, over: false, winner: null }
    }
    if (this.settled === 'victory') {
      return { phase: 'victory', running: false, over: true, winner: 'hero' }
    }
    if (this.settled === 'defeat') {
      return { phase: 'defeat', running: false, over: true, winner: 'enemy' }
    }
    if (this.running) {
      return { phase: 'fighting', running: true, over: false, winner: null }
    }
    return { phase: 'placing', running: false, over: false, winner: null }
  }

  setRunning(value: boolean) {
    if (!this.sim || this.settled) return
    this.running = value
  }

  beginDrag(unitId: string) {
    if (!this.isPlacing()) return false
    const unit = this.sim?.units.find((u) => u.id === unitId)
    if (!unit || unit.team !== 'hero' || !unit.alive) return false
    this.dragUnitId = unitId
    return true
  }

  endDrag() {
    this.dragUnitId = null
  }

  getDragUnitId() {
    return this.dragUnitId
  }

  /** Same nearest-target ordering used by the sim, for honest formation UI. */
  previewOpeningTarget(unitId: string, from?: Hex): string | null {
    if (!this.sim) return null
    const unit = this.sim.units.find((candidate) => candidate.id === unitId && candidate.alive)
    if (!unit) return null
    const origin = from ?? unit.hex
    let best: HexUnit | null = null
    let bestDistance = Infinity
    for (const enemy of this.sim.units) {
      if (!enemy.alive || enemy.team === unit.team) continue
      const distance = hexDistance(origin, enemy.hex)
      if (
        distance < bestDistance ||
        (distance === bestDistance &&
          best &&
          (enemy.hp < best.hp || (enemy.hp === best.hp && enemy.id < best.id)))
      ) {
        best = enemy
        bestDistance = distance
      }
    }
    return best?.id ?? null
  }

  moveUnit(unitId: string, hex: Hex): boolean {
    if (!this.sim || !this.isPlacing()) return false
    const unit = this.sim.units.find((u) => u.id === unitId)
    if (!unit || unit.team !== 'hero') return false
    if (!this.isHeroDeployHex(hex)) return false
    return this.sim.relocateUnit(unitId, hex)
  }

  /** Advance sim only while running. Always safe to call each frame. */
  advance(dt: number) {
    if (!this.sim || !this.running || this.settled) return
    const scale = Math.min(dt, 0.05)
    this.accumulator += scale
    while (this.accumulator >= FIXED_DT && !this.sim.isOver()) {
      const events = this.sim.step(FIXED_DT)
      if (events.length && this.onEvents) this.onEvents(events)
      this.accumulator -= FIXED_DT
    }
    if (this.sim.isOver()) {
      this.running = false
      const heroesAlive = this.sim.units.some((u) => u.alive && u.team === 'hero')
      this.settled = heroesAlive ? 'victory' : 'defeat'
    }
  }

  mirrorSnapshot(): MirrorUnit[] {
    if (!this.sim) return []
    return this.sim.units.map((unit) => {
      const frac =
        this.dragUnitId === unit.id
          ? { ...unit.hex }
          : this.sim!.fractionalHexOf(unit)
      const pos = fractionalHexToWorldXZ(frac.q, frac.r, this.origin, this.hexSize)
      return {
        id: unit.id,
        actorId: unit.actorId,
        name: actorDisplayName(unit.id),
        team: unit.team,
        hex: { ...unit.hex },
        x: pos.x,
        z: pos.z,
        hp: unit.hp,
        maxHp: unit.stats.maxHp,
        attackRangeHexes: unit.stats.attackRangeHexes,
        alive: unit.alive,
        activity: unit.activity,
      }
    })
  }

  /** World positions of defeated enemies at settle time (for loot). */
  defeatedEnemyPositions(): { id: string; x: number; z: number }[] {
    if (!this.sim) return []
    return this.sim.units
      .filter((u) => u.team === 'enemy' && !u.alive)
      .map((u) => {
        const pos = fractionalHexToWorldXZ(u.hex.q, u.hex.r, this.origin, this.hexSize)
        return { id: u.id, x: pos.x, z: pos.z }
      })
  }
}

/** Shared singleton used by world bridge + HUD. */
export const hexBattleDriver = new HexBattleDriver()
