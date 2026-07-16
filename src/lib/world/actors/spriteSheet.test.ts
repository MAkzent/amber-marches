import { describe, expect, it } from 'vitest'
import {
  facingForVelocity,
  facingRow,
  frameIndex,
  frameUv,
  motionForMovement,
  textureColumns,
  textureRows,
} from './spriteSheet'

describe('Minifantasy sprite sheet utilities', () => {
  it('maps movement quadrants to facing labels', () => {
    expect(facingForVelocity(1, 1)).toBe('front-right')
    expect(facingForVelocity(-1, 1)).toBe('front-left')
    expect(facingForVelocity(1, -1)).toBe('back-right')
    expect(facingForVelocity(-1, -1)).toBe('back-left')
  })

  it('maps isometric facings to down, left, right, and up rows', () => {
    expect(facingRow('front-right')).toBe(0)
    expect(facingRow('front-left')).toBe(1)
    expect(facingRow('back-right')).toBe(2)
    expect(facingRow('back-left')).toBe(3)
  })

  it('selects idle, walk, and run from movement input', () => {
    expect(motionForMovement(false, false)).toBe('idle')
    expect(motionForMovement(false, true)).toBe('idle')
    expect(motionForMovement(true, false)).toBe('walk')
    expect(motionForMovement(true, true)).toBe('run')
  })

  it('uses authored timing and emits four-direction UV windows', () => {
    expect(frameIndex(0.45, 4, 'walk')).toBe(2)
    expect(frameIndex(0.85, 4, 'walk')).toBe(0)
    expect(frameIndex(0.5, 4, 'run')).toBe(0)
    expect(textureColumns(128)).toBe(4)
    expect(textureRows(128)).toBe(4)
    expect(frameUv(2, 4, facingRow('front-left'))).toEqual({
      repeat: [0.25, 0.25],
      offset: [0.5, 0.5],
    })
    expect(frameUv(2, 4, facingRow('back-left'))).toEqual({
      repeat: [0.25, 0.25],
      offset: [0.5, 0],
    })
  })

  it('clamps attack frames instead of looping', () => {
    expect(frameIndex(0, 6, 'attack')).toBe(0)
    expect(frameIndex(0.24, 6, 'attack')).toBe(3)
    expect(frameIndex(0.8, 6, 'attack')).toBe(5)
  })
})
