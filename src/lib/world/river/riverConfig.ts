/** Performance-first Silverrun rendering budget. */
export const RIVER_LENGTH_SEGMENTS = 128
export const RIVER_WIDTH_SEGMENTS = 8

export const RIVER_PALETTE = {
  shallow: '#4e7a74',
  deep: '#1c323c',
  ford: '#6a9682',
  fordBed: '#8a8058',
  foam: '#b5d8cc',
} as const

export const RIVER_RENDER_ORDER = {
  surface: 1,
  wakeRings: 2,
  splash: 3,
  bridgeShadow: 4,
  bridge: 5,
} as const
