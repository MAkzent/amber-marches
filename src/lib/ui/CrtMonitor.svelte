<script lang="ts">
  import type { Snippet } from 'svelte'

  let { children }: { children: Snippet } = $props()
</script>

<div class="crt-stage">
  <div class="crt-screen" data-testid="crt-screen">
    {@render children()}
    <div class="screen-frame" aria-hidden="true"></div>
  </div>
</div>

<style>
  .crt-stage {
    position: absolute;
    inset: 0;
    background: #000;
  }

  .crt-screen {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #090d15;
    isolation: isolate;
    touch-action: none;
  }

  /*
   * Thick black aperture with a soft inward fade —
   * solid rim first, then layered inset shadows for the stylized dissolve.
   * Below HUD / joystick (z 14+) so chrome stays readable on the edge.
   */
  .screen-frame {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    border-radius: 0;
    box-shadow:
      inset 0 0 0 clamp(3px, 0.47vw, 6px) #000,
      inset 0 0 clamp(9px, 1.33vw, 17px) clamp(3px, 0.53vw, 7px) rgba(0, 0, 0, 0.92),
      inset 0 0 clamp(19px, 2.67vw, 37px) clamp(7px, 1.07vw, 16px) rgba(0, 0, 0, 0.55),
      inset 0 0 clamp(30px, 4vw, 53px) clamp(12px, 1.67vw, 24px) rgba(0, 0, 0, 0.28);
  }

  .screen-frame::before {
    content: '';
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  }
</style>
