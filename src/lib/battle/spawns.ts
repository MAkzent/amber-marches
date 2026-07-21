import { hexDistance, hexesWithin, hexKey, type Hex, type HexUnitStats, type UnitSpawn } from './hexsim'
import {
  BOARD_RADIUS,
  ENEMY_DEPLOY_HEXES,
  HERO_DEPLOY_HEXES,
} from './battleMap'

/**
 * Left-to-right formation: heroes west (−q), enemies east (+q).
 * Explore/battle cameras sit south of the board (+Z) looking north (−Z), so
 * −q reads left and +q reads right on screen.
 */
export { BOARD_RADIUS, ENEMY_DEPLOY_HEXES, HERO_DEPLOY_HEXES } from './battleMap'

export type BattleActorKind =
  | 'paladin'
  | 'ranger'
  | 'wizard'
  | 'assassin'
  | 'gargoyle'
  | 'gnoll'
  | 'giant-rat'

export type BattleActorDef = {
  id: string
  actorId: BattleActorKind
  team: 'hero' | 'enemy'
  name: string
  maxHp: number
  attackDamage: number
  attackRangeHexes: number
  /** Seconds per anim frame for basic attack. */
  frameSeconds: number
  frameCount: number
  impactFrame: number
  secondsPerHex: number
}

function statsFromDef(def: BattleActorDef): HexUnitStats {
  const windup = def.impactFrame * def.frameSeconds
  const duration = Math.max(windup + 0.08, def.frameCount * def.frameSeconds)
  const cooldown = Math.max(duration, 0.45)
  return {
    maxHp: def.maxHp,
    attackDamage: def.attackDamage,
    secondsPerHex: def.secondsPerHex,
    attackRangeHexes: def.attackRangeHexes,
    attackCooldownSeconds: cooldown,
    attackWindupSeconds: windup,
    attackDurationSeconds: duration,
    speed: 10,
  }
}

export const PARTY_ACTORS: BattleActorDef[] = [
  {
    id: 'hero-paladin',
    actorId: 'paladin',
    team: 'hero',
    name: 'Paladin',
    maxHp: 96,
    attackDamage: 18,
    attackRangeHexes: 1,
    frameSeconds: 0.08,
    frameCount: 6,
    impactFrame: 4,
    secondsPerHex: 0.28,
  },
  {
    id: 'hero-ranger',
    actorId: 'ranger',
    team: 'hero',
    name: 'Ranger',
    maxHp: 72,
    attackDamage: 14,
    attackRangeHexes: 3,
    frameSeconds: 0.08,
    frameCount: 5,
    impactFrame: 2,
    secondsPerHex: 0.24,
  },
  {
    id: 'hero-wizard',
    actorId: 'wizard',
    team: 'hero',
    name: 'Wizard',
    maxHp: 64,
    attackDamage: 16,
    attackRangeHexes: 3,
    frameSeconds: 0.09,
    frameCount: 5,
    impactFrame: 2,
    secondsPerHex: 0.3,
  },
  {
    id: 'hero-assassin',
    actorId: 'assassin',
    team: 'hero',
    name: 'Assassin',
    maxHp: 70,
    attackDamage: 20,
    attackRangeHexes: 1,
    frameSeconds: 0.07,
    frameCount: 5,
    impactFrame: 2,
    secondsPerHex: 0.22,
  },
]

export const ENEMY_ACTORS: BattleActorDef[] = [
  {
    id: 'gargoyle-sentinel',
    actorId: 'gargoyle',
    team: 'enemy',
    name: 'Vale Gargoyle',
    maxHp: 56,
    attackDamage: 8,
    attackRangeHexes: 1,
    frameSeconds: 0.1,
    frameCount: 4,
    impactFrame: 2,
    secondsPerHex: 0.35,
  },
  {
    id: 'bramble-gnoll',
    actorId: 'gnoll',
    team: 'enemy',
    name: 'Bramble Gnoll',
    maxHp: 48,
    attackDamage: 9,
    attackRangeHexes: 1,
    frameSeconds: 0.1,
    frameCount: 4,
    impactFrame: 2,
    secondsPerHex: 0.3,
  },
  {
    id: 'silverrun-rat',
    actorId: 'giant-rat',
    team: 'enemy',
    name: 'Silverrun Rat',
    maxHp: 36,
    attackDamage: 6,
    attackRangeHexes: 1,
    frameSeconds: 0.09,
    frameCount: 4,
    impactFrame: 1,
    secondsPerHex: 0.26,
  },
]

export function spawnFromDef(def: BattleActorDef, hex: Hex): UnitSpawn {
  return {
    id: def.id,
    actorId: def.actorId,
    team: def.team,
    hex: { ...hex },
    stats: statsFromDef(def),
  }
}

export type SpawnBuildOptions = {
  heroes?: BattleActorDef[]
  enemies?: BattleActorDef[]
  /** Terrain / obstacle hexes — skipped for deploy + spawn placement. */
  blocked?: Hex[]
  boardRadius?: number
  heroDeploy?: readonly Hex[]
  enemyDeploy?: readonly Hex[]
}

/** Preferred deploy list minus blocked cells (order preserved). */
export function openDeployCells(preferred: readonly Hex[], blocked: readonly Hex[] = []): Hex[] {
  const blockedKeys = new Set(blocked.map((h) => hexKey(h)))
  return preferred.filter((h) => !blockedKeys.has(hexKey(h))).map((h) => ({ ...h }))
}

/**
 * Enough open cells for `count` units: preferred deploy first, then same-side
 * board hexes nearest the deploy centroid.
 */
export function resolveDeploySlots(
  preferred: readonly Hex[],
  count: number,
  team: 'hero' | 'enemy',
  blocked: readonly Hex[] = [],
  boardRadius = BOARD_RADIUS,
): Hex[] {
  const blockedKeys = new Set(blocked.map((h) => hexKey(h)))
  const open = openDeployCells(preferred, blocked)
  if (open.length >= count) return open.slice(0, count)

  const used = new Set(open.map((h) => hexKey(h)))
  const centroid = preferred.reduce(
    (acc, h) => ({ q: acc.q + h.q / preferred.length, r: acc.r + h.r / preferred.length }),
    { q: 0, r: 0 },
  )
  const extras = hexesWithin({ q: 0, r: 0 }, boardRadius)
    .filter((h) => {
      if (blockedKeys.has(hexKey(h)) || used.has(hexKey(h))) return false
      if (team === 'hero' && h.q >= 0) return false
      if (team === 'enemy' && h.q <= 0) return false
      return true
    })
    .sort((a, b) => {
      const da = hexDistance(a, centroid)
      const db = hexDistance(b, centroid)
      if (da !== db) return da - db
      if (a.q !== b.q) return a.q - b.q
      return a.r - b.r
    })

  const slots = [...open]
  for (const hex of extras) {
    if (slots.length >= count) break
    slots.push({ ...hex })
    used.add(hexKey(hex))
  }
  return slots
}

export function buildDefaultSpawns(options: SpawnBuildOptions = {}): UnitSpawn[] {
  const heroes = options.heroes ?? PARTY_ACTORS
  const enemies = options.enemies ?? ENEMY_ACTORS
  const blocked = options.blocked ?? []
  const boardRadius = options.boardRadius ?? BOARD_RADIUS
  const heroDeploy = options.heroDeploy ?? HERO_DEPLOY_HEXES
  const enemyDeploy = options.enemyDeploy ?? ENEMY_DEPLOY_HEXES

  const heroSlots = resolveDeploySlots(
    heroDeploy,
    heroes.length,
    'hero',
    blocked,
    boardRadius,
  )
  const enemySlots = resolveDeploySlots(
    enemyDeploy,
    enemies.length,
    'enemy',
    blocked,
    boardRadius,
  )

  const spawns: UnitSpawn[] = []
  heroes.forEach((def, i) => {
    const hex = heroSlots[i]
    if (!hex) throw new Error(`No open hero deploy cell for '${def.id}'`)
    spawns.push(spawnFromDef(def, hex))
  })
  enemies.forEach((def, i) => {
    const hex = enemySlots[i]
    if (!hex) throw new Error(`No open enemy deploy cell for '${def.id}'`)
    spawns.push(spawnFromDef(def, hex))
  })
  return spawns
}

/** Authored preferred hero deploy (ignores terrain). Prefer driver open cells in play. */
export function isHeroDeployCell(hex: Hex): boolean {
  return HERO_DEPLOY_HEXES.some((h) => h.q === hex.q && h.r === hex.r)
}

const ACTOR_NAME_BY_ID = new Map(
  [...PARTY_ACTORS, ...ENEMY_ACTORS].map((def) => [def.id, def.name] as const),
)

/** Display name for a battle unit id (falls back to id). */
export function actorDisplayName(id: string): string {
  return ACTOR_NAME_BY_ID.get(id) ?? id
}
