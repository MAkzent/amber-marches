import type { BattleActorKind } from '../../battle'

export type BattleSpriteSet = {
  idle: string
  walk: string
  jump?: string
  attack?: string
  die?: string
  cardHeight: number
  radius: number
}

export const BATTLE_SPRITE_CATALOG: Record<BattleActorKind, BattleSpriteSet> = {
  paladin: {
    idle: '/assets/minifantasy/heroes/paladin/idle.png',
    walk: '/assets/minifantasy/heroes/paladin/walk.png',
    jump: '/assets/minifantasy/heroes/paladin/jump.png',
    attack: '/assets/minifantasy/heroes/paladin/attack.png',
    cardHeight: 3.7,
    radius: 0.42,
  },
  ranger: {
    idle: '/assets/minifantasy/heroes/ranger/idle.png',
    walk: '/assets/minifantasy/heroes/ranger/walk.png',
    jump: '/assets/minifantasy/heroes/ranger/jump.png',
    cardHeight: 3.55,
    radius: 0.4,
  },
  wizard: {
    idle: '/assets/minifantasy/heroes/wizard/idle.png',
    walk: '/assets/minifantasy/heroes/wizard/walk.png',
    jump: '/assets/minifantasy/heroes/wizard/jump.png',
    cardHeight: 3.5,
    radius: 0.4,
  },
  assassin: {
    idle: '/assets/minifantasy/heroes/assassin/idle.png',
    walk: '/assets/minifantasy/heroes/assassin/walk.png',
    jump: '/assets/minifantasy/heroes/assassin/jump.png',
    cardHeight: 3.45,
    radius: 0.38,
  },
  gargoyle: {
    idle: '/assets/minifantasy/enemies/gargoyle/idle.png',
    walk: '/assets/minifantasy/enemies/gargoyle/walk.png',
    die: '/assets/minifantasy/enemies/gargoyle/die.png',
    cardHeight: 4.5,
    radius: 0.72,
  },
  gnoll: {
    idle: '/assets/minifantasy/enemies/gnoll/idle.png',
    walk: '/assets/minifantasy/enemies/gnoll/walk.png',
    die: '/assets/minifantasy/enemies/gnoll/die.png',
    cardHeight: 3.95,
    radius: 0.64,
  },
  'giant-rat': {
    idle: '/assets/minifantasy/enemies/giant-rat/idle.png',
    walk: '/assets/minifantasy/enemies/giant-rat/walk.png',
    die: '/assets/minifantasy/enemies/giant-rat/die.png',
    cardHeight: 3.25,
    radius: 0.52,
  },
}
