import { derived, get, writable } from 'svelte/store'
import { clearAttackSwings, resetCombatRuntime } from './combat'
import { scenery, walkHeight } from './data/sunmereVale'
import { riverCenter } from './data/silverrunChannel'

export type DiscoveryId = 'villager' | 'watchtower'
export type WeatherMode = 'sunshower' | 'clear' | 'fireflies' | 'snow'
/** Demo story beats: speak → hunt → return → done. */
export type QuestPhase = 'speak' | 'hunt' | 'return' | 'done'

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

/** Explore = soft isometric follow. Converse = NPC face shot. Battle = hex board frame. */
export type CameraMode =
  | { kind: 'explore' }
  | {
      kind: 'converse'
      /** Speaker feet XZ. */
      focus: [number, number]
      /** World-space height of the face look-at. */
      faceY: number
    }
  | {
      kind: 'battle'
      /** Board focus feet XZ. */
      focus: [number, number]
    }

/** Screen-space anchor for the speech bubble (updated by the camera each frame). */
export const dialogueAnchor = {
  x: 0.5,
  y: 0.35,
  visible: false,
}

const PRIEST_INTRO_DIALOGUE: DialogueLine[] = [
  {
    speaker: 'Mara the Bellkeeper',
    text: 'Hold a moment, travelers. Something stalks the woods north of the Silverrun — and Sunmere will not sleep while it grows bold.',
  },
  {
    speaker: 'Mara the Bellkeeper',
    text: 'Cross the river. Find them beyond the bridge, and defeat them. Protect this village.',
  },
  {
    speaker: 'Mara the Bellkeeper',
    text: 'When the path is clear, return to me. I will see you rewarded.',
  },
]

const PRIEST_REWARD_DIALOGUE: DialogueLine[] = [
  {
    speaker: 'Mara the Bellkeeper',
    text: 'You return with the quiet of the woods behind you. Sunmere owes you its thanks.',
  },
  {
    speaker: 'Mara the Bellkeeper',
    text: 'Take this blessing — small, but sincere. The vale remembers those who stand for it.',
  },
]

/** First talk after the pack was already cleared — she notices without a briefing. */
const PRIEST_RECOGNITION_DIALOGUE: DialogueLine[] = [
  {
    speaker: 'Mara the Bellkeeper',
    text: 'The woods have gone quiet — I felt it before you spoke. You already faced what waited north of the Silverrun.',
  },
  {
    speaker: 'Mara the Bellkeeper',
    text: 'Sunmere is safer for your steel. Take this blessing — small, but sincere. The vale remembers those who stand for it.',
  },
]

export const discoveries: Discovery[] = [
  {
    id: 'villager',
    eyebrow: 'A voice on the road',
    title: 'The Bellkeeper',
    description: 'Mara asks you to protect Sunmere from the threat beyond the river.',
    position: [-7, 9],
    radius: 3.4,
    action: 'Speak',
    portrait: '/assets/minifantasy/heroes/cleric/idle.png',
    dialogue: PRIEST_INTRO_DIALOGUE,
  },
  {
    id: 'watchtower',
    eyebrow: 'Landmark restored',
    title: 'Larkspur Watch',
    description: 'The banner catches the last light. Evening settles gently over the vale.',
    position: [22, -22],
    radius: 3.6,
    action: 'Raise the banner',
  },
]

function priestDialogueForPhase(phase: QuestPhase): DialogueLine[] | null {
  if (phase === 'speak') {
    return get(questPackCleared) ? PRIEST_RECOGNITION_DIALOGUE : PRIEST_INTRO_DIALOGUE
  }
  if (phase === 'return') return PRIEST_REWARD_DIALOGUE
  return null
}

export function priestInteractable(phase: QuestPhase = get(questPhase)): boolean {
  return phase === 'speak' || phase === 'return'
}

const treeOcclusionAnchor = scenery
  .filter((point) => point.kind === 'oak' || point.kind === 'pine')
  .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0]
const treeOcclusionStart: [number, number] = treeOcclusionAnchor
  ? [treeOcclusionAnchor.x - 1.32, treeOcclusionAnchor.z - 1.64]
  : [1, 20]

const artStartLocations: Record<string, [number, number]> = {
  village: [-7, 9],
  bridge: [6, riverCenter(6)],
  ford: [-20, riverCenter(-20)],
  shrine: [-17.1, -16],
  watchtower: [18.8, -22],
  ascent: [-11.2, -17.0],
  /** Encounter approach — dedicated visual-test start, just outside the pack. */
  combat: [1.7, -17.2],
  trees: treeOcclusionStart,
}
const artStart =
  typeof window === 'undefined'
    ? null
    : artStartLocations[new URLSearchParams(window.location.search).get('art') ?? '']
const liveStart = artStart ?? ([1, 20] as [number, number])
const liveStartY = walkHeight(liveStart[0], liveStart[1])

export const playerPosition = writable<[number, number]>(liveStart)
/** Per-frame world position for camera/weather — avoid Svelte store churn every tick. */
export const playerLive = {
  x: liveStart[0],
  z: liveStart[1],
}
/** Per-frame party feet; only slot 0 drives controlled-character tree occlusion. */
export const partyLive: Array<{ x: number; y: number; z: number }> = [
  { x: liveStart[0], y: liveStartY, z: liveStart[1] },
  { x: liveStart[0], y: liveStartY, z: liveStart[1] },
  { x: liveStart[0], y: liveStartY, z: liveStart[1] },
  { x: liveStart[0], y: liveStartY, z: liveStart[1] },
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
export const questPhase = writable<QuestPhase>('speak')
/** True once the hex pack is defeated (even before Mara’s briefing). */
export const questPackCleared = writable(false)
/** Demo-end reward card after returning to Mara. */
export const demoEndVisible = writable(false)
/** Soft gold glow at Mara after the reward dialogue. */
export const questRewardGlow = writable(false)
export type GraphicsTier = 'desktop' | 'mobile'

/** Coarse pointer / touch phones — lower GPU budget (post-FX, grass, particles). */
export function detectGraphicsTier(
  media: Pick<MediaQueryList, 'matches'> | null = typeof window === 'undefined'
    ? null
    : window.matchMedia('(pointer: coarse)'),
  touchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
  viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth,
): GraphicsTier {
  if (media?.matches) return 'mobile'
  if (touchPoints > 0 && viewportWidth < 900) return 'mobile'
  return 'desktop'
}

export const graphicsTier = writable<GraphicsTier>(detectGraphicsTier())
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

/** Called when the hex pack is cleared — advances hunt → return, or flags early clears. */
export function notifyQuestPackCleared() {
  questPackCleared.set(true)
  if (get(questPhase) === 'hunt') {
    questPhase.set('return')
  }
}

export const objective = derived([questPhase, questPackCleared], ([$phase, $cleared]) => {
  switch ($phase) {
    case 'speak':
      return $cleared
        ? 'Tell Mara you cleared the woods to the north'
        : 'Speak with Mara in the village'
    case 'hunt':
      return 'Cross the Silverrun and defeat the pack to the north'
    case 'return':
      return 'Return to Mara for your reward'
    case 'done':
      return 'Demo complete — feel free to explore'
  }
})

export const questSteps = derived([questPhase, questPackCleared], ([$phase, $cleared]) => [
  {
    id: 'speak' as const,
    label: 'Speak with Mara',
    done: $phase !== 'speak',
    // After an early clear, the active beat is reporting — not the briefing.
    current: $phase === 'speak' && !$cleared,
  },
  {
    id: 'hunt' as const,
    label: 'Defeat the threat beyond the river',
    done: $cleared || $phase === 'return' || $phase === 'done',
    current: $phase === 'hunt',
  },
  {
    id: 'return' as const,
    label: $phase === 'speak' && $cleared ? 'Report to Mara' : 'Return to Mara',
    done: $phase === 'done',
    current: $phase === 'return' || ($phase === 'speak' && $cleared),
  },
])

let demoEndTimer: ReturnType<typeof setTimeout> | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined

function discoveryAvailable(discovery: Discovery): boolean {
  if (discovery.id === 'villager') return priestInteractable()
  return !get(completedDiscoveries).has(discovery.id)
}

export function updateNearby(x: number, z: number) {
  if (get(activeDialogue)) {
    if (get(nearbyDiscovery)) nearbyDiscovery.set(null)
    return
  }

  const candidate =
    discoveries
      .filter(discoveryAvailable)
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

function grantDemoReward() {
  questPhase.set('done')
  questRewardGlow.set(true)
  demoEndVisible.set(true)
  clearTimeout(demoEndTimer)
  demoEndTimer = setTimeout(() => demoEndVisible.set(false), 7200)
}

function markVillagerSpoken() {
  completedDiscoveries.update((current) => {
    const next = new Set(current)
    next.add('villager')
    return next
  })
}

function finishPriestDialogue() {
  const phase = get(questPhase)
  nearbyDiscovery.set(null)

  if (phase === 'speak') {
    markVillagerSpoken()
    // Pack already cleared before the briefing — recognition talk ends the demo.
    if (get(questPackCleared)) {
      grantDemoReward()
      return
    }
    questPhase.set('hunt')
    return
  }

  if (phase === 'return') {
    markVillagerSpoken()
    grantDemoReward()
  }
}

export function startDialogue(discovery: Discovery) {
  const lines = priestDialogueForPhase(get(questPhase))
  if (!lines?.length) {
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
  activeDialogue.set({
    discovery: { ...discovery, dialogue: lines },
    lineIndex: 0,
    ready: false,
  })
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
    activeDialogue.set(null)
    cameraMode.set({ kind: 'explore' })
    dialogueAnchor.visible = false
    finishPriestDialogue()
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

  if (discovery.id === 'villager' && priestInteractable()) {
    startDialogue(discovery)
    return
  }

  if (discovery.id === 'watchtower') {
    finishDiscovery(discovery)
  }
}

export function dismissDemoEnd() {
  demoEndVisible.set(false)
  clearTimeout(demoEndTimer)
}

export function resetWorld() {
  clearAttackSwings()
  resetCombatRuntime()
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
    slot.y = walkHeight(1, 20)
    slot.z = 20
  }
  playerPosition.set([1, 20])
  clearTouchMove()
  dusk.set(false)
  weatherMode.set('sunshower')
  introVisible.set(true)
  questPhase.set('speak')
  questPackCleared.set(false)
  demoEndVisible.set(false)
  questRewardGlow.set(false)
  clearTimeout(demoEndTimer)
  clearTimeout(toastTimer)
}
