import { derived, get, writable } from 'svelte/store'

export type DiscoveryId = 'sunfruit' | 'shrine' | 'bridge' | 'villager' | 'watchtower'
export type WeatherMode = 'sunshower' | 'clear' | 'fireflies'

export type Discovery = {
  id: DiscoveryId
  title: string
  eyebrow: string
  description: string
  position: [number, number]
  radius: number
  action: string
}

export const discoveries: Discovery[] = [
  {
    id: 'villager',
    eyebrow: 'A voice on the road',
    title: 'The Bellkeeper',
    description: 'Mara marks the old pilgrim road and asks you to wake its sleeping lights.',
    position: [-7, 9],
    radius: 3.4,
    action: 'Speak',
  },
  {
    id: 'sunfruit',
    eyebrow: 'Forage',
    title: 'Sunmere Rowan',
    description: 'A honey-bright cluster, warm even beneath the shade.',
    position: [15, 13],
    radius: 2.5,
    action: 'Gather',
  },
  {
    id: 'bridge',
    eyebrow: 'Vista discovered',
    title: 'The Silverrun',
    description: 'From here the vale opens: shrinewood west, watchtower east.',
    position: [6, -2],
    radius: 3.2,
    action: 'Take in the view',
  },
  {
    id: 'shrine',
    eyebrow: 'Old magic',
    title: 'Shrine of Small Mercies',
    description: 'The weathered stones answer with a patient gold light.',
    position: [-20, -16],
    radius: 3.1,
    action: 'Awaken',
  },
  {
    id: 'watchtower',
    eyebrow: 'Landmark restored',
    title: 'Larkspur Watch',
    description: 'Its beacon carries across the valley. The pilgrim road is whole again.',
    position: [22, -22],
    radius: 3.6,
    action: 'Raise the banner',
  },
]

const artStartLocations: Record<string, [number, number]> = {
  village: [-7, 9],
  bridge: [6, -2],
  shrine: [-17.1, -16],
  watchtower: [18.8, -22],
}
const artStart =
  typeof window === 'undefined'
    ? null
    : artStartLocations[new URLSearchParams(window.location.search).get('art') ?? '']

export const playerPosition = writable<[number, number]>(artStart ?? [1, 20])
/** Per-frame world position for camera/weather — avoid Svelte store churn every tick. */
export const playerLive = {
  x: (artStart ?? [1, 20])[0],
  z: (artStart ?? [1, 20])[1],
}
/** Camera-relative binary axes from the floating touch joystick (−1 / 0 / 1). */
export const touchMove = {
  right: 0,
  forward: 0,
}

export function clearTouchMove() {
  touchMove.right = 0
  touchMove.forward = 0
}
export const nearbyDiscovery = writable<Discovery | null>(null)
export const completedDiscoveries = writable<Set<DiscoveryId>>(new Set())
export const activeToast = writable<Discovery | null>(null)
export const introVisible = writable(true)
export const audioEnabled = writable(false)
export const reducedMotion = writable(false)
export const dusk = writable(false)
export const weatherMode = writable<WeatherMode>('sunshower')

export const discoveryCount = derived(completedDiscoveries, ($completed) => $completed.size)
export const objective = derived(completedDiscoveries, ($completed) => {
  if (!$completed.has('villager')) return 'Follow the lantern road into Sunmere'
  if (!$completed.has('shrine') || !$completed.has('watchtower')) return 'Wake the two lights beyond the Silverrun'
  return 'Return to the vale when you are ready'
})

let toastTimer: ReturnType<typeof setTimeout> | undefined

export function updateNearby(x: number, z: number) {
  const completed = get(completedDiscoveries)
  const candidate =
    discoveries
      .filter((discovery) => !completed.has(discovery.id))
      .map((discovery) => ({
        discovery,
        distance: Math.hypot(discovery.position[0] - x, discovery.position[1] - z),
      }))
      .filter(({ discovery, distance }) => distance <= discovery.radius)
      .sort((a, b) => a.distance - b.distance)[0]?.discovery ?? null

  if (get(nearbyDiscovery)?.id !== candidate?.id) nearbyDiscovery.set(candidate)
}

export function completeNearby() {
  const discovery = get(nearbyDiscovery)
  if (!discovery) return

  completedDiscoveries.update((current) => {
    const next = new Set(current)
    next.add(discovery.id)
    return next
  })
  nearbyDiscovery.set(null)
  activeToast.set(discovery)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => activeToast.set(null), 4600)

  if (discovery.id === 'watchtower') {
    dusk.set(true)
    weatherMode.set('fireflies')
  }
}

export function resetWorld() {
  completedDiscoveries.set(new Set())
  nearbyDiscovery.set(null)
  activeToast.set(null)
  playerLive.x = 1
  playerLive.z = 20
  playerPosition.set([1, 20])
  clearTouchMove()
  dusk.set(false)
  weatherMode.set('sunshower')
  introVisible.set(true)
}
