import { writable } from 'svelte/store'

export type PlacementPreview = {
  q: number
  r: number
  valid: boolean
  unitId: string
  targetId: string | null
}

/** Active drop target and its opening matchup preview. */
export const placementHighlight = writable<PlacementPreview | null>(null)
