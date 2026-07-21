<script lang="ts">
  import { battleHud } from '../world/battle'

  const blend = $derived($battleHud.stageBlend)
  const active = $derived(blend > 0.01 || $battleHud.phase !== 'idle')
</script>

{#if active}
  <div
    class="battle-drama"
    style={`--stage:${blend}`}
    aria-hidden="true"
  >
    <!-- Light edge wash only — no cartoon accents. -->
    <div class="ink-veil"></div>
  </div>
{/if}

<style>
  .battle-drama {
    position: absolute;
    inset: 0;
    z-index: 6;
    overflow: hidden;
    pointer-events: none;
    opacity: calc(0.34 * var(--stage, 0));
    will-change: opacity;
  }

  /* Soft warm edge — keeps focus on the board without crushing the vale. */
  .ink-veil {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        ellipse 78% 74% at 50% 48%,
        transparent 0%,
        transparent 58%,
        rgba(22, 14, 10, 0.16) 82%,
        rgba(14, 10, 8, 0.38) 100%
      ),
      linear-gradient(
        180deg,
        rgba(16, 12, 8, 0.22) 0%,
        transparent 14%,
        transparent 86%,
        rgba(16, 12, 8, 0.2) 100%
      );
    mix-blend-mode: multiply;
  }
</style>
