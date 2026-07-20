/** Minifantasy True Heroes — 32×32 cells arranged down, left, right, up. */
export const FRAME_WIDTH = 32
export const FRAME_HEIGHT = 32
export const SHEET_ROWS = 4
export const FRAME_SECONDS = { idle: 0.2, walk: 0.2, run: 0.12, attack: 0.08 } as const

export type Facing = 'front-right' | 'front-left' | 'back-right' | 'back-left'
export type Motion = keyof typeof FRAME_SECONDS

/** Motions that loop while held; attack plays once then yields to locomotion. */
export const LOOPING_MOTIONS: ReadonlySet<Motion> = new Set(['idle', 'walk', 'run'])

/**
 * Camera-relative movement lands in world-space quadrants in the isometric rig.
 * The labels map to the Minifantasy rows: down, left, right, up.
 */
export function facingRow(facing: Facing): number {
  switch (facing) {
    case 'front-right':
      return 0
    case 'front-left':
      return 1
    case 'back-right':
      return 2
    case 'back-left':
      return 3
  }
}

export function facingForVelocity(x: number, z: number, fallback: Facing = 'front-right'): Facing {
  if (Math.abs(x) + Math.abs(z) < 0.001) return fallback
  const depth = z < 0 ? 'back' : 'front'
  const side = x < 0 ? 'left' : 'right'
  return `${depth}-${side}`
}

export function motionForMovement(moving: boolean, runModifier: boolean): Motion {
  if (!moving) return 'idle'
  return runModifier ? 'run' : 'walk'
}

export function frameIndex(elapsed: number, frameCount: number, motion: Motion) {
  if (frameCount <= 1) return 0
  const raw = Math.floor(elapsed / FRAME_SECONDS[motion])
  if (LOOPING_MOTIONS.has(motion)) return raw % frameCount
  return Math.min(frameCount - 1, raw)
}

export function oneShotFrameIndex(
  elapsed: number,
  frameCount: number,
  frameSeconds: number,
) {
  if (frameCount <= 1) return 0
  return Math.min(frameCount - 1, Math.floor(elapsed / Math.max(0.001, frameSeconds)))
}

export function textureColumns(imageWidth: number) {
  return Math.max(1, Math.round(imageWidth / FRAME_WIDTH))
}

export function textureRows(imageHeight: number) {
  return Math.max(1, Math.round(imageHeight / FRAME_HEIGHT))
}

/**
 * UV window for a Minifantasy frame. Texture V coordinates start at the
 * bottom, while sheet rows are numbered from the top.
 */
export function frameUv(
  frame: number,
  frameCount: number,
  row: number,
  rowCount = SHEET_ROWS,
): { repeat: [number, number]; offset: [number, number] } {
  const columns = Math.max(1, frameCount)
  const rows = Math.max(1, rowCount)
  const safeRow = Math.min(rows - 1, Math.max(0, row))
  const repeatX = 1 / columns
  const repeatY = 1 / rows
  return {
    repeat: [repeatX, repeatY],
    offset: [frame * repeatX, (rows - safeRow - 1) * repeatY],
  }
}
