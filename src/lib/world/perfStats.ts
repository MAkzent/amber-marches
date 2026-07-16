import { writable } from 'svelte/store'
import type { WebGLRenderer } from 'three'

export type PerfSnapshot = {
  fps: number
  ms: number
  calls: number
  triangles: number
  geometries: number
  textures: number
}

export const perfStats = writable<PerfSnapshot>({
  fps: 0,
  ms: 0,
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
})

const PUBLISH_INTERVAL = 0.28

let frames = 0
let elapsed = 0

export function samplePerf(delta: number, info: WebGLRenderer['info']) {
  frames += 1
  elapsed += delta

  if (elapsed < PUBLISH_INTERVAL) return

  const fps = frames / elapsed
  const ms = (elapsed / frames) * 1000

  perfStats.set({
    fps: Math.round(fps),
    ms: Math.round(ms * 10) / 10,
    calls: info.render.calls,
    triangles: info.render.triangles,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
  })

  frames = 0
  elapsed = 0
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${Math.round(value / 1000)}k`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}
