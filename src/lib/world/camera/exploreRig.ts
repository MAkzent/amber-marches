/**
 * Soft isometric explore perch — south-east of the party (+X/+Z), looking
 * toward −Z (north on the HUD compass). Steeper pitch (~43°) for classic
 * JRPG map framing. Shared by WorldCamera and water FX that must match the
 * same billboard read. Compass contract: silverrunChannel.ts.
 */

export const OFFSET_X = 0.66
export const OFFSET_Y = 0.98
export const OFFSET_Z = 0.82

const lookSpan = Math.hypot(OFFSET_X, OFFSET_Z)

/** Look target offset along −rig XZ so framing never shears with distance. */
export const LOOK_ALONG = 2.8
export const LOOK_X = (-OFFSET_X / lookSpan) * LOOK_ALONG
export const LOOK_Z = (-OFFSET_Z / lookSpan) * LOOK_ALONG
export const LOOK_HEIGHT = 1.15

export const EXPLORE_FOV = 36
export const EXPLORE_DISTANCE_DEFAULT = 30
export const EXPLORE_DISTANCE_MIN = 22
export const EXPLORE_DISTANCE_MAX = 42

/** Soft combat pull-in (still explore mode). */
export const COMBAT_FOV = 30.5
export const COMBAT_DISTANCE_SCALE = 0.78
export const COMBAT_DISTANCE_MIN = 18
/**
 * Aim slightly toward feet while zoomed in so the party sits higher in frame
 * (positive look-Y pushes sprites down the screen under this isometric perch).
 */
export const COMBAT_LOOK_LIFT = -0.55
