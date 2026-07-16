/**
 * Terrain grounding — derive prop root Y from the height field + model foot.
 * Authored placements should be XZ (+ yaw/scale/bias) only; never free world Y.
 */

/**
 * How to combine terrain samples under a building footprint.
 *
 * - `center` — single sample at the pivot (fast; fine on gentle ground)
 * - `max`    — sit on the highest point under the pad so uphill feet don't clip
 * - `mean`   — compromise on slopes (small sink uphill / small float downhill)
 */
export type TerrainPadMode = 'center' | 'max' | 'mean'

export type GroundingOptions = {
  /** World XZ of the model pivot. */
  x: number
  z: number
  /** Height field sampler (terrainHeight, walkHeight, …). */
  heightAt: (x: number, z: number) => number
  /**
   * Model-space Y of the visual foot (typically `bbox.min.y` for the prop).
   * KayKit medieval props sit on local y = 0, so this defaults to 0.
   * World foot Y = rootY + footLocalY * scale.
   */
  footLocalY?: number
  /** Uniform scale applied to the model. */
  scale?: number
  /**
   * Extra contact offset in world units after grounding.
   * Positive lifts slightly (anti z-fight / foundation). Negative digs in.
   */
  contactBias?: number
  /** Radius of the slope pad in world units. 0 = center sample only. */
  padRadius?: number
  padMode?: TerrainPadMode
  /** Samples around the pad ring (ignored when padRadius is 0). */
  padSamples?: number
}

export const DEFAULT_CONTACT_BIAS = 0.04

/**
 * Sample the height field under a disc. Used so large props don't pick a
 * single misleading center height on steep slopes or mounds.
 */
export function sampleTerrainPad(
  x: number,
  z: number,
  radius: number,
  heightAt: (x: number, z: number) => number,
  mode: TerrainPadMode = 'max',
  samples = 8,
) {
  const center = heightAt(x, z)
  if (radius <= 1e-6 || mode === 'center') return center

  let max = center
  let sum = center
  const count = Math.max(3, samples)
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2
    const h = heightAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius)
    max = Math.max(max, h)
    sum += h
  }

  if (mode === 'mean') return sum / (count + 1)
  return max
}

/**
 * World-space root Y that plants a model's foot on the height field.
 *
 *   worldFootY = rootY + footLocalY * scale
 *   want       = surfaceY + contactBias
 *   ⇒ rootY    = surfaceY + contactBias - footLocalY * scale
 */
export function groundedRootY(options: GroundingOptions) {
  const scale = options.scale ?? 1
  const footLocalY = options.footLocalY ?? 0
  const contactBias = options.contactBias ?? DEFAULT_CONTACT_BIAS
  const padRadius = options.padRadius ?? 0
  const padMode = options.padMode ?? (padRadius > 0 ? 'max' : 'center')

  const surfaceY = sampleTerrainPad(
    options.x,
    options.z,
    padRadius,
    options.heightAt,
    padMode,
    options.padSamples ?? 8,
  )

  return surfaceY + contactBias - footLocalY * scale
}

/** Foot contact Y after grounding — should match surface + contactBias when pad is center. */
export function groundedFootY(options: GroundingOptions) {
  const scale = options.scale ?? 1
  const footLocalY = options.footLocalY ?? 0
  return groundedRootY(options) + footLocalY * scale
}

/**
 * Gap between the visual foot and the height field at the pivot.
 * Positive = floating, negative = sunk. ≈ contactBias when padMode is center.
 */
export function footContactGap(options: GroundingOptions) {
  return groundedFootY(options) - options.heightAt(options.x, options.z)
}
