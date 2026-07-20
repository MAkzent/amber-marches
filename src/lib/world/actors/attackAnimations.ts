import type { AttackAnimationTiming } from '../combat'
import { FRAME_SECONDS } from './spriteSheet'

export type CharacterAttackAnimations = Record<string, AttackAnimationTiming>

/**
 * Sprite-authored combat events live with character art, not ability balance.
 * Frame indices are zero-based.
 */
export const CHARACTER_ATTACK_ANIMATIONS: Record<
  string,
  CharacterAttackAnimations
> = {
  paladin: {
    'auto-attack': {
      frameCount: 6,
      frameSeconds: FRAME_SECONDS.attack,
      // Frame 4 is the hammer-down contact pose (frame 3 is its anticipation).
      impactFrame: 4,
    },
  },
}

export function attackAnimationFor(characterId: string, moduleId: string) {
  return CHARACTER_ATTACK_ANIMATIONS[characterId]?.[moduleId]
}
