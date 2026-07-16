import { derived, get, writable } from 'svelte/store'
import { walkHeight } from './data/sunmereVale'
import { riverCenter } from './data/silverrunChannel'

export type DiscoveryId = 'sunfruit' | 'shrine' | 'bridge' | 'villager' | 'watchtower' | 'ascent'
export type WeatherMode = 'sunshower' | 'clear' | 'fireflies' | 'snow'

export type DialogueLine = {
  speaker: string
  text: string
}

export type Discovery = {
  id: DiscoveryId
  title: string
  eyebrow: string
  description: string
  position: [number, number]
  radius: number
  action: string
  /** When set, Speak opens a JRPG dialogue box instead of a toast. */
  dialogue?: DialogueLine[]
  portrait?: string
}

export type ActiveDialogue = {
  discovery: Discovery
  lineIndex: number
  /** False while the camera is framing the speaker. */
  ready: boolean
}

/** Explore = soft isometric follow. Converse = horizontal face shot of an NPC. */
export type CameraMode =
  | { kind: 'explore' }
  | {
      kind: 'converse'
      /** Speaker feet XZ. */
      focus: [number, number]
      /** World-space height of the face look-at. */
      faceY: number
    }

/** Screen-space anchor for the speech bubble (updated by the camera each frame). */
export const dialogueAnchor = {
  x: 0.5,
  y: 0.35,
  visible: false,
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
    portrait: '/assets/minifantasy/heroes/cleric/idle.png',
    dialogue: [
      {
        speaker: 'Mara the Bellkeeper',
        text: 'Hold a moment, traveler. The bells of Sunmere have gone quiet… and quiet never means peace here.',
      },
      {
        speaker: 'Mara the Bellkeeper',
        text: 'Lanterns once lit the pilgrim road — shrinewood west, Larkspur Watch east. Wake those sleeping lights.',
      },
      {
        speaker: 'Mara the Bellkeeper',
        text: 'Do that, and the vale will remember your name. The Amber Marches still keep their promises.',
      },
    ],
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
    position: [6, riverCenter(6)],
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
  {
    id: 'ascent',
    eyebrow: 'Forgotten path',
    title: 'The Whispering Ascent',
    description: 'Stone steps climb into pale mist. Something old still listens at the top.',
    position: [-17.6, -26.8],
    radius: 3.2,
    action: 'Listen',
  },
]

const artStartLocations: Record<string, [number, number]> = {
  village: [-7, 9],
  bridge: [6, riverCenter(6)],
  ford: [-20, riverCenter(-20)],
  shrine: [-17.1, -16],
  watchtower: [18.8, -22],
  ascent: [-11.2, -17.0],
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
/** Per-frame party feet for grass trample / local FX (leader + followers). */
export const partyLive: Array<{ x: number; z: number }> = [
  { x: (artStart ?? [1, 20])[0], z: (artStart ?? [1, 20])[1] },
  { x: (artStart ?? [1, 20])[0], z: (artStart ?? [1, 20])[1] },
  { x: (artStart ?? [1, 20])[0], z: (artStart ?? [1, 20])[1] },
  { x: (artStart ?? [1, 20])[0], z: (artStart ?? [1, 20])[1] },
]
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
export const activeDialogue = writable<ActiveDialogue | null>(null)
export const cameraMode = writable<CameraMode>({ kind: 'explore' })
export const introVisible = writable(true)
export const audioEnabled = writable(false)
export const reducedMotion = writable(false)
export const dusk = writable(false)
export const weatherMode = writable<WeatherMode>('sunshower')

/**
 * Soft combat engagement for camera / HUD.
 * `engaged` is the discrete flag; `intensity` eases 0→1 for smooth framing.
 */
export const combatLive = {
  engaged: false,
  /** Seconds remaining before auto-disengage after the last pulse. */
  linger: 0,
  /** Smoothed 0..1 — camera dollies in with this. */
  intensity: 0,
}

const COMBAT_LINGER_DEFAULT = 2.15

/** Refresh combat engagement (call on each swing / hostile action). */
export function pulseCombat(lingerSeconds = COMBAT_LINGER_DEFAULT) {
  combatLive.engaged = true
  combatLive.linger = Math.max(combatLive.linger, lingerSeconds)
}

/** Advance linger + ease intensity. Call once per frame from the camera. */
export function tickCombatLive(delta: number, instant = false) {
  if (combatLive.linger > 0) {
    combatLive.linger = Math.max(0, combatLive.linger - delta)
    if (combatLive.linger === 0) combatLive.engaged = false
  }

  const target = combatLive.engaged ? 1 : 0
  if (instant) {
    combatLive.intensity = target
    return
  }
  // Snappy pull-in; slower release so the battle frame lingers.
  const ease = 1 - Math.pow(combatLive.engaged ? 0.05 : 0.009, delta)
  combatLive.intensity += (target - combatLive.intensity) * ease
  if (Math.abs(combatLive.intensity - target) < 0.001) combatLive.intensity = target
}

export const discoveryCount = derived(completedDiscoveries, ($completed) => $completed.size)
export const objective = derived(completedDiscoveries, ($completed) => {
  if (!$completed.has('villager')) return 'Follow the lantern road into Sunmere'
  if (!$completed.has('shrine') || !$completed.has('watchtower')) return 'Wake the two lights beyond the Silverrun'
  return 'Return to the vale when you are ready'
})

export const questSteps = derived(completedDiscoveries, ($completed) => [
  {
    id: 'villager' as const,
    label: 'Speak with the Bellkeeper',
    done: $completed.has('villager'),
  },
  {
    id: 'shrine' as const,
    label: 'Awaken the Shrine of Small Mercies',
    done: $completed.has('shrine'),
  },
  {
    id: 'watchtower' as const,
    label: 'Raise the banner at Larkspur Watch',
    done: $completed.has('watchtower'),
  },
])

let toastTimer: ReturnType<typeof setTimeout> | undefined

export function updateNearby(x: number, z: number) {
  if (get(activeDialogue)) {
    if (get(nearbyDiscovery)) nearbyDiscovery.set(null)
    return
  }

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

function finishDiscovery(discovery: Discovery) {
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

export function startDialogue(discovery: Discovery) {
  if (!discovery.dialogue?.length) {
    finishDiscovery(discovery)
    return
  }
  nearbyDiscovery.set(null)
  const [fx, fz] = discovery.position
  cameraMode.set({
    kind: 'converse',
    focus: [fx, fz],
    faceY: walkHeight(fx, fz) + 2.55,
  })
  dialogueAnchor.visible = false
  activeDialogue.set({ discovery, lineIndex: 0, ready: false })
}

/** Called by the camera once the converse framing has settled. */
export function markDialogueReady() {
  const session = get(activeDialogue)
  if (!session || session.ready) return
  activeDialogue.set({ ...session, ready: true })
}

export function advanceDialogue() {
  const session = get(activeDialogue)
  if (!session?.ready) return

  const lines = session.discovery.dialogue ?? []
  const nextIndex = session.lineIndex + 1
  if (nextIndex >= lines.length) {
    const discovery = session.discovery
    activeDialogue.set(null)
    cameraMode.set({ kind: 'explore' })
    dialogueAnchor.visible = false
    finishDiscovery(discovery)
    return
  }

  activeDialogue.set({ discovery: session.discovery, lineIndex: nextIndex, ready: true })
}

/** Interact with nearby discovery, or advance an open dialogue. */
export function completeNearby() {
  const dialogue = get(activeDialogue)
  if (dialogue) {
    advanceDialogue()
    return
  }

  const discovery = get(nearbyDiscovery)
  if (!discovery) return

  if (discovery.dialogue?.length) {
    startDialogue(discovery)
    return
  }

  finishDiscovery(discovery)
}

export function resetWorld() {
  completedDiscoveries.set(new Set())
  nearbyDiscovery.set(null)
  activeToast.set(null)
  activeDialogue.set(null)
  cameraMode.set({ kind: 'explore' })
  dialogueAnchor.visible = false
  combatLive.engaged = false
  combatLive.linger = 0
  combatLive.intensity = 0
  playerLive.x = 1
  playerLive.z = 20
  for (const slot of partyLive) {
    slot.x = 1
    slot.z = 20
  }
  playerPosition.set([1, 20])
  clearTouchMove()
  dusk.set(false)
  weatherMode.set('sunshower')
  introVisible.set(true)
}
