/**
 * Snap helpers so roads, bridges, and water stay coherent as the vale grows.
 *
 * Rules:
 * 1. Bridge centers snap onto the river centerline.
 * 2. Through-roads insert bank abutments in travel order (no mid-ford zigzag).
 * 3. Branch junctions meet at abutments on the bank, never mid-water alone.
 * 4. Road mesh gaps open water entirely — the procedural stone deck is the crossing.
 */

import {
  BRIDGE_SPANS,
  type BridgeSpan,
  findSpanAt,
  snapBridgeToRiver,
  spanAbutments,
} from './crossings'

export type RoadWaypoint = [number, number]

export type RoadDraft = {
  /** Authored waypoints. May include a loose ford crossing that snap will rewrite. */
  waypoints: RoadWaypoint[]
  /** When set, the polyline is forced through this span's abutments. */
  crossSpanId?: string
  /** When set, the first waypoint snaps to the nearer abutment of this span (branch join). */
  joinSpanId?: string
}

const SNAP_EPS = 0.08

function nearlySame(a: RoadWaypoint, b: RoadWaypoint, eps = SNAP_EPS) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < eps
}

function distSq(a: RoadWaypoint, b: RoadWaypoint) {
  const dx = a[0] - b[0]
  const dz = a[1] - b[1]
  return dx * dx + dz * dz
}

function dedupeSequential(points: RoadWaypoint[]): RoadWaypoint[] {
  const out: RoadWaypoint[] = []
  for (const p of points) {
    if (out.length === 0 || !nearlySame(out[out.length - 1], p)) out.push(p)
  }
  return out
}

function spanById(id: string): BridgeSpan {
  const span = BRIDGE_SPANS.find((entry) => entry.id === id)
  if (!span) throw new Error(`Unknown bridge span: ${id}`)
  return span
}

/**
 * Pick the abutment closer to `point`, and the opposite one.
 */
export function nearestAbutment(
  span: BridgeSpan,
  point: RoadWaypoint,
): { near: RoadWaypoint; far: RoadWaypoint; nearIndex: 0 | 1 } {
  const [a, b] = spanAbutments(span)
  if (distSq(point, a) <= distSq(point, b)) {
    return { near: a, far: b, nearIndex: 0 }
  }
  return { near: b, far: a, nearIndex: 1 }
}

/**
 * Rewrite a through-road so it enters at the near abutment and exits at the far
 * one, ordered by travel from the first authored waypoint. No deck-center
 * waypoint — that forced CatmullRom samples (and dirt strips) through the water.
 */
export function snapRoadAcrossSpan(waypoints: RoadWaypoint[], span: BridgeSpan): RoadWaypoint[] {
  if (waypoints.length < 2) return waypoints

  const first = waypoints[0]
  const { near: enterPt, far: exitPt } = nearestAbutment(span, first)

  // Drop authored samples that sit on the open span — abutments replace them.
  const head: RoadWaypoint[] = []
  for (const p of waypoints) {
    if (findSpanAt(p[0], p[1], 0.9)) break
    head.push(p)
  }

  const tail: RoadWaypoint[] = []
  let seenSpan = false
  for (const p of waypoints) {
    if (findSpanAt(p[0], p[1], 0.9)) {
      seenSpan = true
      continue
    }
    if (seenSpan) tail.push(p)
  }

  // If nothing was classified as on-span (loose ford), split at nearest approach.
  if (head.length === waypoints.length) {
    const deck: RoadWaypoint = [span.x, span.z]
    let bestI = 0
    let bestD = Infinity
    for (let i = 0; i < waypoints.length; i += 1) {
      const d = distSq(waypoints[i], deck)
      if (d < bestD) {
        bestD = d
        bestI = i
      }
    }
    return dedupeSequential([
      ...waypoints.slice(0, bestI),
      enterPt,
      exitPt,
      ...waypoints.slice(bestI + 1),
    ])
  }

  return dedupeSequential([...head, enterPt, exitPt, ...tail])
}

/** Snap a branch's first vertex onto the nearer abutment (Y-junction on the bank). */
export function snapRoadJoinSpan(waypoints: RoadWaypoint[], span: BridgeSpan): RoadWaypoint[] {
  if (waypoints.length === 0) return waypoints
  // Prefer the abutment nearer the branch destination so Y-junctions sit on the
  // correct approach, not an arbitrary side when the draft starts on the deck.
  const anchor = waypoints.length > 1 ? waypoints[1] : waypoints[0]
  const { near } = nearestAbutment(span, anchor)
  return dedupeSequential([near, ...waypoints.slice(1)])
}

/**
 * Build the final road network from drafts. Call once at module init so
 * Terrain, grass clearance, and collision all share snapped polylines.
 */
export function buildSnappedRoadNetwork(drafts: RoadDraft[]): RoadWaypoint[][] {
  return drafts.map((draft) => {
    let points = draft.waypoints.map((p) => [p[0], p[1]] as RoadWaypoint)
    if (draft.crossSpanId) {
      points = snapRoadAcrossSpan(points, spanById(draft.crossSpanId))
    }
    if (draft.joinSpanId) {
      points = snapRoadJoinSpan(points, spanById(draft.joinSpanId))
    }
    return points
  })
}

export { snapBridgeToRiver }
