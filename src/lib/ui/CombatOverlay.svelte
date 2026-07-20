<script lang="ts">
  import { combatHud } from '../world/combat'
</script>

<div class="combat-overlay" aria-live="polite">
  {#each $combatHud.enemies as enemy (enemy.id)}
    {#if enemy.onScreen && enemy.alive}
      <div
        class="enemy-vitals"
        class:focused={enemy.focused}
        style={`left:${enemy.screenX * 100}%;top:${enemy.screenY * 100}%`}
        data-testid={`enemy-health-${enemy.id}`}
        data-health={enemy.health}
        data-max-health={enemy.maxHealth}
      >
        <span>{enemy.name}</span>
        <div class="health-track" aria-label={`${enemy.name} health`}>
          <i style={`width:${(enemy.health / enemy.maxHealth) * 100}%`}></i>
        </div>
      </div>
    {/if}
  {/each}

  {#each $combatHud.damage as hit (hit.id)}
    {#if hit.onScreen}
      <strong
        class="damage-number"
        class:defeated={hit.defeated}
        style={`left:${hit.screenX * 100}%;top:${hit.screenY * 100}%`}
        data-testid="damage-number"
      >
        {hit.amount}
      </strong>
    {/if}
  {/each}
</div>

<style>
  .combat-overlay {
    position: absolute;
    inset: 0;
    z-index: 23;
    overflow: hidden;
    pointer-events: none;
  }

  .enemy-vitals {
    position: absolute;
    width: 122px;
    transform: translate(-50%, -100%);
    color: #f8df9b;
    font-size: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-align: center;
    text-transform: uppercase;
    text-shadow: 0 2px 0 #120b08, 0 0 5px rgba(0, 0, 0, 0.9);
    filter: drop-shadow(0 3px 1px rgba(8, 6, 9, 0.58));
    transition: opacity 100ms linear;
  }

  .enemy-vitals span {
    position: relative;
    display: inline-block;
    min-width: 76px;
    margin-bottom: 5px;
    padding: 2px 10px 1px;
    border-top: 1px solid rgba(239, 208, 138, 0.62);
    border-bottom: 1px solid rgba(239, 208, 138, 0.35);
    background: linear-gradient(90deg, transparent, rgba(14, 12, 18, 0.88) 18%, rgba(14, 12, 18, 0.88) 82%, transparent);
  }

  .enemy-vitals.focused {
    color: #fff1bd;
    filter:
      drop-shadow(0 3px 1px rgba(8, 6, 9, 0.58))
      drop-shadow(0 0 5px rgba(239, 208, 138, 0.34));
  }

  .enemy-vitals.focused span::before,
  .enemy-vitals.focused span::after {
    background: #efd08a;
    box-shadow: 0 0 4px rgba(239, 208, 138, 0.72);
  }

  .enemy-vitals span::before,
  .enemy-vitals span::after {
    position: absolute;
    top: 50%;
    width: 5px;
    height: 5px;
    border: 1px solid #efd08a;
    background: #7a2630;
    content: '';
    transform: translateY(-50%) rotate(45deg);
  }

  .enemy-vitals span::before {
    left: -1px;
  }

  .enemy-vitals span::after {
    right: -1px;
  }

  .health-track {
    position: relative;
    height: 11px;
    padding: 3px 7px;
    border: 0;
    background: #17121a;
    clip-path: polygon(7px 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 7px 100%, 0 50%);
    box-shadow: inset 0 0 0 2px #120b0d;
  }

  .health-track::before {
    position: absolute;
    inset: 1px;
    border: 1px solid rgba(239, 208, 138, 0.82);
    clip-path: inherit;
    content: '';
    pointer-events: none;
  }

  .health-track::after {
    position: absolute;
    inset: 3px 7px;
    background: repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent calc(20% - 1px),
      rgba(28, 8, 12, 0.5) calc(20% - 1px),
      rgba(28, 8, 12, 0.5) 20%
    );
    content: '';
    pointer-events: none;
  }

  .health-track i {
    display: block;
    height: 100%;
    background:
      linear-gradient(180deg, rgba(255, 226, 153, 0.55), transparent 38%),
      linear-gradient(90deg, #8f2632, #d9463e 72%, #f08050);
    box-shadow:
      0 0 5px rgba(224, 69, 60, 0.4),
      inset 0 -1px 0 rgba(73, 16, 25, 0.65);
    transition: width 180ms cubic-bezier(0.2, 0.9, 0.2, 1);
  }

  .damage-number {
    position: absolute;
    display: block;
    min-width: 2ch;
    color: #fff0a8;
    font-family: var(--font-damage);
    font-size: clamp(1.35rem, 3vw, 2rem);
    font-weight: 400;
    line-height: 1;
    text-align: center;
    -webkit-text-stroke: 2px #4c1712;
    paint-order: stroke fill;
    filter: drop-shadow(0 3px 0 rgba(28, 8, 7, 0.65));
    transform: translate(-50%, -50%);
    animation: damage-pop 1.02s cubic-bezier(0.16, 0.8, 0.24, 1) both;
    will-change: transform, opacity;
  }

  .damage-number.defeated {
    color: #ffffff;
    font-size: clamp(1.55rem, 3.4vw, 2.3rem);
    -webkit-text-stroke-color: #7c241d;
  }

  @keyframes damage-pop {
    0% {
      opacity: 0;
      transform: translate(-50%, -20%) scale(0.45) rotate(-7deg);
    }
    18% {
      opacity: 1;
      transform: translate(-50%, -70%) scale(1.24) rotate(3deg);
    }
    42% {
      transform: translate(-50%, -82%) scale(0.96) rotate(-1deg);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -170%) scale(0.86) rotate(1deg);
    }
  }

  @media (max-width: 720px), (pointer: coarse) {
    .enemy-vitals {
      width: 104px;
      font-size: 0.45rem;
    }

    .health-track {
      height: 10px;
    }

    .damage-number {
      font-size: 1.45rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .damage-number {
      animation-name: damage-fade;
    }
  }

  @keyframes damage-fade {
    0%, 70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
