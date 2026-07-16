import { walkHeight } from './sunmereVale'

export type Vec3Like = { x: number; y: number; z: number }

/**
 * Intersect a world-space ray with the analytical walk surface y = heightAt(x, z).
 *
 * Needed because the camera is a pitched perspective (soft isometric): a flat Y=0
 * plane pick systematically misses hills/bridge/tower by several world units.
 *
 * Method: march along the ray looking for
 *   1) a sign change of f(t) = heightAt(x(t),z(t)) − y(t)  (true pierce), or
 *   2) a local maximum of f while f ≤ 0 that comes within `grazeSkin` of the
 *      surface (grazing a raised deck whose peak falls between samples).
 * Then binary-refine the hit.
 */
export function intersectHeightfield(
  origin: Vec3Like,
  direction: Vec3Like,
  out: Vec3Like,
  options?: {
    heightAt?: (x: number, z: number) => number
    maxDistance?: number
    /** Max world-units per march sample. Keep ≤~0.5 so bridge decks are not skipped. */
    maxStep?: number
    refineSteps?: number
    /** Accept a graze if the ray comes this close above the surface without crossing. */
    grazeSkin?: number
  },
): boolean {
  const heightAt = options?.heightAt ?? walkHeight
  const maxDistance = options?.maxDistance ?? 160
  const maxStep = options?.maxStep ?? 0.4
  const refineSteps = options?.refineSteps ?? 16
  const grazeSkin = options?.grazeSkin ?? 0.12

  const sampleF = (t: number) => {
    const x = origin.x + direction.x * t
    const y = origin.y + direction.y * t
    const z = origin.z + direction.z * t
    return heightAt(x, z) - y
  }

  const writeHit = (t: number) => {
    out.x = origin.x + direction.x * t
    out.z = origin.z + direction.z * t
    out.y = heightAt(out.x, out.z)
  }

  const refineCrossing = (lo: number, hi: number, loF: number) => {
    let a = lo
    let b = hi
    let aF = loF
    for (let k = 0; k < refineSteps; k += 1) {
      const mid = (a + b) * 0.5
      const midF = sampleF(mid)
      if (aF * midF <= 0) {
        b = mid
      } else {
        a = mid
        aF = midF
      }
    }
    writeHit((a + b) * 0.5)
  }

  /** Refine a graze by climbing toward the local max of f on [lo, hi]. */
  const refineGraze = (lo: number, hi: number) => {
    let a = lo
    let b = hi
    for (let k = 0; k < refineSteps; k += 1) {
      const m1 = a + (b - a) / 3
      const m2 = b - (b - a) / 3
      if (sampleF(m1) < sampleF(m2)) a = m1
      else b = m2
    }
    writeHit((a + b) * 0.5)
  }

  let prevT = 0
  let prevF = sampleF(0)
  let prevPrevF = prevF
  let prevPrevT = 0

  if (Math.abs(prevF) < 1e-4) {
    writeHit(0)
    return true
  }

  for (let t = maxStep; t <= maxDistance + 1e-9; t += maxStep) {
    const f = sampleF(t)

    // True surface pierce (including exact zeros).
    if (prevF === 0 || f === 0 || prevF * f < 0) {
      refineCrossing(prevT, t, prevF)
      return true
    }

    // Graze: local max of f while still above the surface, close enough to count.
    if (
      t > maxStep &&
      prevPrevF < prevF &&
      f <= prevF &&
      prevF <= 0 &&
      prevF >= -grazeSkin
    ) {
      refineGraze(prevPrevT, t)
      return true
    }

    prevPrevT = prevT
    prevPrevF = prevF
    prevT = t
    prevF = f
  }

  return false
}
