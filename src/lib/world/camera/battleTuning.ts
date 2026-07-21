import { writable } from 'svelte/store'

/** Live-tunable battle camera / framing knobs (hex encounter). */
export type BattleTuning = {
  /** Vertical FOV while in battle. */
  fov: number
  /** Orbit around the board (degrees, + = clockwise from above). */
  yawDeg: number
  /** Camera elevation above the board plane. */
  elevationDeg: number
  /**
   * Extra look-Y (negative raises the board in frame — room for Start CTA).
   */
  lookLift: number
  /** Screen X bias of the board centre (−1 left … 1 right). */
  focusNdcX: number
  /** Screen Y bias of the board centre (−1 lower … 1 higher). */
  focusNdcY: number
  /** Horizontal frustum pad (fraction of NDC). */
  padX: number
  /**
   * Vertical frustum pad. Negative allows the near board edge to sit slightly
   * into the vignette — same trade the old steep perch made, but with a
   * closer / lower shot.
   */
  padY: number
  /** Floor / ceiling on solved board-fit distance. */
  distanceMin: number
  distanceMax: number
  /** Extra world metres beyond hex centres (cell edge). */
  boardMargin: number
}

export const BATTLE_TUNING_DEFAULTS: BattleTuning = {
  fov: 34,
  yawDeg: 24,
  elevationDeg: 42,
  lookLift: -0.22,
  focusNdcX: 0,
  focusNdcY: 0.05,
  padX: 0.08,
  padY: 0.13,
  distanceMin: 12,
  distanceMax: 68,
  boardMargin: 0.45,
}

export const battleTuning = writable<BattleTuning>({ ...BATTLE_TUNING_DEFAULTS })

export function resetBattleTuning() {
  battleTuning.set({ ...BATTLE_TUNING_DEFAULTS })
}

export function patchBattleTuning(patch: Partial<BattleTuning>) {
  battleTuning.update((current) => ({ ...current, ...patch }))
}
