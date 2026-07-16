/** Shared valley wind — one direction + one slow envelope for trees and debris. */
const rawX = 0.86
const rawZ = 0.38
const invLen = 1 / Math.hypot(rawX, rawZ)

export const WIND = {
  dirX: rawX * invLen,
  dirZ: rawZ * invLen,
} as const

export type WindEnvelope = {
  breeze: number
  gust: number
  /** 0–1ish scalar: how hard the wind is pushing right now. */
  strength: number
  /** Signed along-wind swell used by both canopy lean and debris drift. */
  push: number
}

let windTime = 0

/** Advance the shared wind clock once per frame (from Wind.svelte). */
export function advanceWind(delta: number, motion = 1) {
  windTime += delta * motion
}

export function getWindTime() {
  return windTime
}

/**
 * Slow breath + occasional gust. No high-frequency terms — those made the
 * canopy feel nauseating and drifted out of sync with the particle field.
 */
export function windEnvelope(t = windTime): WindEnvelope {
  const breeze = 0.42 + 0.22 * Math.sin(t * 0.28)
  const gust = Math.pow(Math.max(0, Math.sin(t * 0.14) * Math.sin(t * 0.041 + 0.75)), 2.4) * 1.15
  const strength = Math.min(1.35, breeze + gust)
  // Same wave the debris speeds up on — trees lean with this, not against it.
  const push = 0.35 + 0.4 * strength + 0.2 * Math.sin(t * 0.28)
  return { breeze, gust, strength, push }
}

/**
 * Gentle world-space lean: canopy tips along +WIND (same way leaves/streaks travel).
 * `phase` only adds a tiny lag so the stand isn't perfectly rigid — never opposing.
 */
export function treeWindLean(t: number, phase: number) {
  const lag = phase * 0.22
  const { push, gust } = windEnvelope(t - lag)
  // Soft max ~1.5° base, ~2.5° in a gust — readable, not dizzying.
  const lean = 0.012 * push + gust * 0.01
  return {
    x: lean * WIND.dirZ,
    z: -lean * WIND.dirX,
  }
}
