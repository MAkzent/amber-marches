import { writable } from 'svelte/store'

/** Live-tunable converse camera / framing knobs (quest dialogue). */
export type ConverseTuning = {
  /** Screen X of the party+speaker cluster (−1 left … 1 right). */
  clusterNdcX: number
  /** Screen Y bias for the look target (−1 lower … 1 higher). */
  clusterNdcY: number
  /** How far the converse perch sits from the cluster. */
  converseDist: number
  /** Camera height above ground during converse. */
  converseHeight: number
  /** Look-at height above ground. */
  converseLookY: number
  /** 0 = stay on explore rig, 1 = full converse perch. */
  converseStrength: number
  /** 0 = frame speaker only, 1 = frame party only (look midpoint mix). */
  partyWeight: number
  /** Extra world offset along party→speaker (− toward party, + toward speaker). */
  speakerPull: number
  /** Lateral offset of the look target (camera-right units). */
  lateralBias: number
  /** Extra perch nudge along camera-right as a fraction of lookShift. */
  perchSideNudge: number
  /** FOV while conversing. */
  fov: number
  /** Extra yaw orbit around the cluster (degrees, + = clockwise from above). */
  yawOffset: number
  /** Extra pitch tilt (degrees, + = look more downward). */
  pitchOffset: number
  /** Dolly in/out multiplier on perch distance. */
  dolly: number

  /** Speech bubble fixed width (px). */
  bubbleWidth: number
  /** Speech bubble fixed height (px). */
  bubbleHeight: number
  /** Head anchor height above walk surface (tail tip). */
  bubbleHeadY: number
  /** Lateral X nudge of the head anchor in world space. */
  bubbleSideX: number
  /** Lateral Z nudge of the head anchor in world space. */
  bubbleSideZ: number
}

export const CONVERSE_TUNING_DEFAULTS: ConverseTuning = {
  clusterNdcX: -0.05,
  clusterNdcY: 0.11,
  converseDist: 17.1,
  converseHeight: 2.8,
  converseLookY: 0.8,
  converseStrength: 0.69,
  partyWeight: 1,
  speakerPull: 0,
  lateralBias: 0,
  perchSideNudge: 0.17,
  fov: 37,
  yawOffset: 1,
  pitchOffset: -8,
  dolly: 1.22,
  bubbleWidth: 408,
  bubbleHeight: 214,
  bubbleHeadY: 2.55,
  bubbleSideX: 0,
  bubbleSideZ: 0,
}

export const converseTuning = writable<ConverseTuning>({ ...CONVERSE_TUNING_DEFAULTS })

export function resetConverseTuning() {
  converseTuning.set({ ...CONVERSE_TUNING_DEFAULTS })
}

export function patchConverseTuning(patch: Partial<ConverseTuning>) {
  converseTuning.update((current) => ({ ...current, ...patch }))
}
