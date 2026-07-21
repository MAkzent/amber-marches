export type EnemyDefinition = {
  id: string
  name: string
  x: number
  z: number
  maxHealth: number
  radius: number
  cardHeight: number
  deathFrameSeconds: number
  /** Fixed screen-space nudge keeps nearby nameplates from stacking. */
  hudOffset: [number, number]
  assets: {
    idle: string
    walk: string
    dmg: string
    die: string
  }
}

/**
 * Horde waits in the woods on Silverrun's north bank (−Z) — players must
 * cross the bridge from the village (south / +Z) and push inland before the
 * encounter arms. See silverrunChannel.ts for the world compass contract.
 */
export const PASSIVE_ENEMIES: EnemyDefinition[] = [
  {
    id: 'gargoyle-sentinel',
    name: 'Vale Gargoyle',
    x: 0.52,
    z: -22.09,
    maxHealth: 72,
    radius: 0.72,
    cardHeight: 4.5,
    deathFrameSeconds: 0.1,
    hudOffset: [-46, -10],
    assets: {
      idle: '/assets/minifantasy/enemies/gargoyle/idle.png',
      walk: '/assets/minifantasy/enemies/gargoyle/walk.png',
      dmg: '/assets/minifantasy/enemies/gargoyle/dmg.png',
      die: '/assets/minifantasy/enemies/gargoyle/die.png',
    },
  },
  {
    id: 'bramble-gnoll',
    name: 'Bramble Gnoll',
    x: 3.01,
    z: -22.62,
    maxHealth: 72,
    radius: 0.64,
    cardHeight: 3.95,
    deathFrameSeconds: 0.1,
    hudOffset: [46, -28],
    assets: {
      idle: '/assets/minifantasy/enemies/gnoll/idle.png',
      walk: '/assets/minifantasy/enemies/gnoll/walk.png',
      dmg: '/assets/minifantasy/enemies/gnoll/dmg.png',
      die: '/assets/minifantasy/enemies/gnoll/die.png',
    },
  },
  {
    id: 'silverrun-rat',
    name: 'Silverrun Rat',
    x: 1.57,
    z: -24.15,
    maxHealth: 48,
    radius: 0.52,
    cardHeight: 3.25,
    deathFrameSeconds: 0.1,
    hudOffset: [0, 0],
    assets: {
      idle: '/assets/minifantasy/enemies/giant-rat/idle.png',
      walk: '/assets/minifantasy/enemies/giant-rat/walk.png',
      dmg: '/assets/minifantasy/enemies/giant-rat/dmg.png',
      die: '/assets/minifantasy/enemies/giant-rat/die.png',
    },
  },
]
