/** Pointy-top axial hex math (Red Blob Games). Pure — no imports. */

export interface Hex {
  q: number
  r: number
}

export function hexKey(h: Hex): string {
  return `${h.q},${h.r}`
}

export function hexEq(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r
}

export const HEX_DIRS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r }
}

export function hexNeighbors(h: Hex): Hex[] {
  return HEX_DIRS.map((d) => hexAdd(h, d))
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

/** Hex centre in local board space. `size` = centre-to-corner radius. */
export function hexToWorld(h: Hex, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (h.q + h.r / 2),
    y: size * 1.5 * h.r,
  }
}

/** Local board space → nearest hex (cube rounding). */
export function worldToHex(x: number, y: number, size: number): Hex {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size
  const r = ((2 / 3) * y) / size
  return hexRound(q, r)
}

export function hexRound(qf: number, rf: number): Hex {
  const sf = -qf - rf
  let q = Math.round(qf)
  let r = Math.round(rf)
  const s = Math.round(sf)
  const dq = Math.abs(q - qf)
  const dr = Math.abs(r - rf)
  const ds = Math.abs(s - sf)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  return { q, r }
}

export function hexRing(center: Hex, radius: number): Hex[] {
  const out: Hex[] = []
  let cur = hexAdd(center, { q: HEX_DIRS[4].q * radius, r: HEX_DIRS[4].r * radius })
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push(cur)
      cur = hexAdd(cur, HEX_DIRS[side])
    }
  }
  return out
}

export function hexesWithin(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [center]
  for (let r = 1; r <= radius; r++) out.push(...hexRing(center, r))
  return out
}

/**
 * A* over a bounded hex board. Returns path INCLUDING start, ending on the
 * walkable hex nearest `goal` (goal may be blocked).
 */
export function findHexPath(
  start: Hex,
  goal: Hex,
  isBlocked: (h: Hex) => boolean,
  boardRadius: number,
): Hex[] {
  interface Node {
    hex: Hex
    g: number
    f: number
    parent: Node | null
  }
  const startNode: Node = { hex: start, g: 0, f: hexDistance(start, goal), parent: null }
  const open: Node[] = [startNode]
  const best = new Map<string, number>([[hexKey(start), 0]])
  let closest = startNode
  let closestDist = hexDistance(start, goal)

  while (open.length > 0) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i
    const node = open.splice(bi, 1)[0]
    const dist = hexDistance(node.hex, goal)
    if (dist < closestDist || (dist === closestDist && node.g < closest.g)) {
      closest = node
      closestDist = dist
    }
    if (dist === 0) break
    for (const next of hexNeighbors(node.hex)) {
      if (hexDistance(next, { q: 0, r: 0 }) > boardRadius) continue
      if (isBlocked(next)) continue
      const g = node.g + 1
      const key = hexKey(next)
      const prev = best.get(key)
      if (prev !== undefined && prev <= g) continue
      best.set(key, g)
      open.push({ hex: next, g, f: g + hexDistance(next, goal), parent: node })
    }
  }

  const path: Hex[] = []
  for (let n: Node | null = closest; n; n = n.parent) path.push(n.hex)
  path.reverse()
  return path
}
