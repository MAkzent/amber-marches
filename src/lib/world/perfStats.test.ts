import { describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import { formatCount, perfStats, samplePerf } from './perfStats'

function mockInfo(overrides?: {
  calls?: number
  triangles?: number
  geometries?: number
  textures?: number
}) {
  return {
    render: {
      calls: overrides?.calls ?? 12,
      triangles: overrides?.triangles ?? 8400,
      points: 0,
      lines: 0,
      frame: 1,
    },
    memory: {
      geometries: overrides?.geometries ?? 18,
      textures: overrides?.textures ?? 9,
    },
  }
}

describe('perfStats', () => {
  it('formats large counts compactly', () => {
    expect(formatCount(420)).toBe('420')
    expect(formatCount(1500)).toBe('1.5k')
    expect(formatCount(128400)).toBe('128k')
    expect(formatCount(2_400_000)).toBe('2.4M')
  })

  it('publishes averaged fps and renderer info after the sample window', () => {
    const baseline = get(perfStats)

    samplePerf(0.1, mockInfo({ calls: 20, triangles: 5000 }) as never)
    expect(get(perfStats)).toEqual(baseline)

    samplePerf(0.1, mockInfo({ calls: 24, triangles: 6200 }) as never)
    samplePerf(0.1, mockInfo({ calls: 22, triangles: 5800, geometries: 21, textures: 11 }) as never)

    const snapshot = get(perfStats)
    expect(snapshot.fps).toBe(10)
    expect(snapshot.ms).toBe(100)
    expect(snapshot.calls).toBe(22)
    expect(snapshot.triangles).toBe(5800)
    expect(snapshot.geometries).toBe(21)
    expect(snapshot.textures).toBe(11)
  })
})
