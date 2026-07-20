import { getAttackModule } from './modules'
import type {
  AbilityDelivery,
  AttackSwingEvent,
  Combatant,
  DamageEvent,
} from './types'

const DEG_TO_RAD = Math.PI / 180

function edgeDistance(
  x: number,
  z: number,
  target: Pick<Combatant, 'x' | 'z' | 'radius'>,
) {
  return Math.max(0, Math.hypot(target.x - x, target.z - z) - target.radius)
}

export function findFocusTarget(
  x: number,
  z: number,
  faction: Combatant['faction'],
  combatants: Combatant[],
  range: number,
  currentTargetId?: string,
) {
  const eligible = (target: Combatant) =>
    target.alive &&
    target.faction !== faction &&
    edgeDistance(x, z, target) <= range

  // Sticky focus prevents two nearby enemies from rapidly trading lock-on.
  const current = currentTargetId
    ? combatants.find((target) => target.id === currentTargetId)
    : undefined
  if (current && eligible(current)) return current

  return combatants
    .filter(eligible)
    .sort(
      (left, right) =>
        edgeDistance(x, z, left) - edgeDistance(x, z, right),
    )[0]
}

export function facingVector(facing: AttackSwingEvent['facing']) {
  const x = facing.endsWith('left') ? -Math.SQRT1_2 : Math.SQRT1_2
  const z = facing.startsWith('back') ? -Math.SQRT1_2 : Math.SQRT1_2
  return { x, z }
}

export function isInsideMeleeArc(
  swing: Pick<AttackSwingEvent, 'x' | 'z' | 'facing'>,
  delivery: AbilityDelivery,
  target: Pick<Combatant, 'x' | 'z' | 'radius'>,
) {
  const dx = target.x - swing.x
  const dz = target.z - swing.z
  const distance = Math.hypot(dx, dz)
  if (distance - target.radius > delivery.range) return false
  if (distance < 1e-5) return true

  const forward = facingVector(swing.facing)
  const alignment = (dx * forward.x + dz * forward.z) / distance
  return alignment >= Math.cos(delivery.arcDegrees * 0.5 * DEG_TO_RAD)
}

/**
 * Resolve one authored hit window. The engine mutates only combat health and
 * returns plain events; actor animation, particles and audio consume those
 * events elsewhere.
 */
export function resolveSwing(
  swing: AttackSwingEvent,
  combatants: Combatant[],
  eventId: () => number,
): DamageEvent[] {
  const module = getAttackModule(swing.moduleId)
  if (!module || module.delivery.kind !== 'melee-arc') return []

  const attacker = combatants.find((combatant) => combatant.id === swing.attackerId)
  const attackerFaction = attacker?.faction ?? 'party'
  const events: DamageEvent[] = []
  const targets = swing.targetId
    ? combatants.filter((combatant) => combatant.id === swing.targetId)
    : combatants

  for (const target of targets) {
    if (!target.alive || target.id === swing.attackerId || target.faction === attackerFaction) {
      continue
    }
    const inRange = edgeDistance(swing.x, swing.z, target) <= module.delivery.range
    if (swing.targetId ? !inRange : !isInsideMeleeArc(swing, module.delivery, target)) continue

    const amount = Math.min(target.health, module.damage)
    target.health = Math.max(0, target.health - module.damage)
    target.alive = target.health > 0
    events.push({
      id: eventId(),
      swingId: swing.id,
      sourceId: swing.attackerId,
      targetId: target.id,
      amount,
      remainingHealth: target.health,
      defeated: !target.alive,
      x: target.x,
      y: 0,
      z: target.z,
      age: 0,
      screenX: -100,
      screenY: -100,
      onScreen: false,
    })
  }

  return events
}

export function createSwingResolver() {
  const resolved = new Set<number>()
  return {
    resolve(
      swing: AttackSwingEvent,
      combatants: Combatant[],
      eventId: () => number,
    ) {
      if (resolved.has(swing.id)) return []
      resolved.add(swing.id)
      return resolveSwing(swing, combatants, eventId)
    },
    reset() {
      resolved.clear()
    },
  }
}
