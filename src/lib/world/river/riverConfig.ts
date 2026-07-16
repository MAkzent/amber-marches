/** Performance-first Silverrun rendering budget. */
export const RIVER_LENGTH_SEGMENTS = 128
export const RIVER_WIDTH_SEGMENTS = 8

export const RIVER_PALETTE = {
  // Anime cyan film — bright shelf shine → deeper sapphire channel.
  shallow: '#2ec4e8',
  deep: '#0d5a7a',
  ford: '#5ad4d0',
  fordBed: '#8a8058',
  foam: '#d4f7ff',
} as const

export const RIVER_RENDER_ORDER = {
  surface: 1,
  wakeRings: 2,
  splash: 3,
  bridgeShadow: 4,
  bridge: 5,
} as const
