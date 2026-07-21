<script lang="ts">
  import { fade, scale } from 'svelte/transition'
  import {
    battleHud,
    battleDamage,
    battleMirror,
    battleVitals,
    requestStartBattle,
  } from '../world/battle'
  import { placementHighlight } from '../world/battle/placementHighlight'
  import BattleDramaOverlay from './BattleDramaOverlay.svelte'

  const heroes = $derived($battleMirror.filter((u) => u.team === 'hero' && u.alive))
  const enemies = $derived($battleMirror.filter((u) => u.team === 'enemy' && u.alive))
  // Mirror shouldShowBattleUnitVitals: only during enter/place/fight, not settle/exit.
  const showVitals = $derived(
    ($battleHud.placing || $battleHud.fighting || $battleHud.entering) &&
      $battleHud.stageBlend > 0.4,
  )
  const previewUnit = $derived(
    $placementHighlight
      ? $battleMirror.find((unit) => unit.id === $placementHighlight?.unitId)
      : null,
  )
  const previewTarget = $derived(
    $placementHighlight?.targetId
      ? $battleMirror.find((unit) => unit.id === $placementHighlight?.targetId)
      : null,
  )
</script>

{#if $battleHud.phase !== 'idle'}
  <BattleDramaOverlay />
  <div
    class="battle-hud"
    data-testid="battle-hud"
    style={`--stage:${$battleHud.stageBlend}`}
  >
    <div class="battle-banner" aria-hidden="true">
      <i></i>
      <span>
        {#if $battleHud.entering}
          Engaging
        {:else if $battleHud.placing}
          Formation
        {:else if $battleHud.fighting}
          Battle
        {:else if $battleHud.phase === 'victory'}
          Victory
        {:else}
          Defeat
        {/if}
      </span>
      <i></i>
    </div>

    {#if $battleHud.entering}
      <p class="battle-hint">Taking the field…</p>
    {:else if $battleHud.placing}
      <p class="battle-hint">Drag heroes onto blue hexes, then start.</p>
      {#if $placementHighlight && previewUnit}
        <div class="formation-preview" class:invalid={!$placementHighlight.valid}>
          <strong>{previewUnit.name}</strong>
          <span>
            {previewUnit.attackRangeHexes > 1
              ? `Range ${previewUnit.attackRangeHexes}`
              : 'Melee'}
            ·
            {#if !$placementHighlight.valid}
              Unavailable tile
            {:else if previewTarget}
              Opens on {previewTarget.name}
            {:else}
              Ready
            {/if}
          </span>
        </div>
      {/if}
      <button
        class="start-battle"
        data-testid="start-battle"
        aria-label="Start Battle"
        transition:scale={{ start: 0.92, duration: 180 }}
        onclick={() => requestStartBattle()}
      >
        <span>Start Battle</span>
      </button>
    {/if}

    {#if showVitals}
      <div class="battle-vitals" aria-hidden="true">
        {#each $battleVitals as unit (unit.id)}
          {#if unit.onScreen && unit.alive}
            <div
              class="unit-vitals"
              class:hero={unit.team === 'hero'}
              class:foe={unit.team === 'enemy'}
              class:targeted={$placementHighlight?.targetId === unit.id}
              style={`left:${unit.screenX * 100}%;top:${unit.screenY * 100}%`}
            >
              <span>{unit.name}</span>
              <div class="health-track">
                <i style={`width:${(unit.hp / unit.maxHp) * 100}%`}></i>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="battle-damage" aria-live="polite">
      {#each $battleDamage as hit (hit.id)}
        <strong
          class:defeated={hit.defeated}
          data-testid="battle-damage"
          style={`left:${hit.screenX * 100}%;top:${hit.screenY * 100}%;opacity:${Math.max(0, 1 - hit.age / 0.9)}`}
        >
          {hit.amount}
        </strong>
      {/each}
    </div>

    {#if $battleHud.placing}
      <div class="battle-roster" aria-label="Battle roster" transition:fade={{ duration: 240 }}>
        <ul class="side party">
          {#each heroes as unit (unit.id)}
            <li>
              <strong>{unit.name}</strong>
              {#if $battleHud.placing}
                <small>{unit.attackRangeHexes > 1 ? `Range ${unit.attackRangeHexes}` : 'Melee'}</small>
              {/if}
              <div class="bar"><i style="width: {(unit.hp / unit.maxHp) * 100}%"></i></div>
            </li>
          {/each}
        </ul>
        <ul class="side foes">
          {#each enemies as unit (unit.id)}
            <li>
              <strong>{unit.name}</strong>
              {#if $battleHud.placing}
                <small>{unit.attackRangeHexes > 1 ? `Range ${unit.attackRangeHexes}` : 'Melee'}</small>
              {/if}
              <div class="bar"><i style="width: {(unit.hp / unit.maxHp) * 100}%"></i></div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}

<style>
  .battle-hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 8;
    opacity: calc(0.2 + 0.8 * var(--stage, 0));
  }

  .battle-banner {
    position: absolute;
    top: 4.4rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--font-ui);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--gold, #efd08a);
    text-shadow: var(--hud-shadow);
    opacity: var(--stage, 0);
  }

  .battle-banner span {
    font-size: 0.72rem;
    font-weight: 600;
  }

  .battle-banner i {
    width: 1.6rem;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold, #efd08a), transparent);
  }

  .battle-hint {
    position: absolute;
    top: 5.85rem;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 0.28rem 0.65rem;
    border: 2px solid rgba(255, 255, 255, 0.28);
    border-radius: 2px;
    border-top-color: var(--gold, #efd08a);
    background: rgba(8, 14, 24, 0.55);
    color: #f2e6cc;
    font-family: var(--font-ui);
    font-size: 0.64rem;
    letter-spacing: 0.04em;
    white-space: nowrap;
    text-shadow: var(--hud-shadow);
    backdrop-filter: blur(6px);
    opacity: var(--stage, 0);
  }

  .start-battle {
    pointer-events: auto;
    position: absolute;
    left: 50%;
    bottom: clamp(1.5rem, 7vh, 3.75rem);
    transform: translateX(-50%);
    border: 2px solid rgba(255, 255, 255, 0.55);
    border-radius: 2px;
    border-top: 3px solid var(--gold, #efd08a);
    padding: 0.62rem 1.35rem;
    background:
      linear-gradient(180deg, rgba(212, 168, 74, 0.22), transparent 42%),
      rgba(8, 14, 24, 0.78);
    color: var(--gold, #efd08a);
    font-family: var(--font-ui);
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-shadow: var(--hud-shadow);
    cursor: pointer;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.45),
      0 8px 22px rgba(8, 10, 18, 0.55);
    backdrop-filter: blur(8px);
  }

  .start-battle:hover {
    border-color: var(--gold, #efd08a);
    color: #fff1bd;
    background:
      linear-gradient(180deg, rgba(239, 208, 138, 0.32), transparent 42%),
      rgba(8, 14, 24, 0.88);
  }

  .start-battle:active {
    transform: translateX(-50%) scale(0.97);
  }

  .formation-preview {
    position: absolute;
    bottom: calc(clamp(1.5rem, 7vh, 3.75rem) + 4rem);
    left: 50%;
    min-width: 12rem;
    transform: translateX(-50%);
    padding: 0.34rem 0.65rem;
    border: 1px solid rgba(255, 224, 138, 0.62);
    border-radius: 2px;
    background: rgba(8, 14, 24, 0.78);
    color: #f4e7c8;
    text-align: center;
    text-shadow: var(--hud-shadow);
    backdrop-filter: blur(6px);
  }

  .formation-preview strong,
  .formation-preview span {
    display: block;
  }

  .formation-preview strong {
    color: #ffe08a;
    font-size: 0.66rem;
  }

  .formation-preview span {
    margin-top: 0.08rem;
    font-size: 0.56rem;
  }

  .formation-preview.invalid {
    border-color: rgba(214, 112, 116, 0.78);
  }

  .formation-preview.invalid strong {
    color: #efaaad;
  }

  .battle-vitals {
    position: absolute;
    inset: 0;
    overflow: hidden;
    opacity: calc(0.4 + 0.6 * var(--stage, 0));
  }

  .battle-damage {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .battle-damage strong {
    position: absolute;
    transform: translate(-50%, -50%);
    color: #fff0a8;
    font-family: var(--font-damage);
    font-size: clamp(1.1rem, 2.4vw, 1.65rem);
    text-shadow:
      0 2px 0 #4b1514,
      0 0 8px rgba(255, 164, 70, 0.72);
  }

  .battle-damage strong.defeated {
    color: #fff;
    font-size: clamp(1.35rem, 3vw, 2rem);
  }

  .unit-vitals {
    position: absolute;
    width: 94px;
    transform: translate(-50%, -100%);
    color: #f8df9b;
    font-family: var(--font-ui);
    font-size: 0.46rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-align: center;
    text-transform: uppercase;
    text-shadow: 0 2px 0 #120b08, 0 0 5px rgba(0, 0, 0, 0.9);
    filter: drop-shadow(0 3px 1px rgba(8, 6, 9, 0.58));
  }

  .unit-vitals span {
    position: relative;
    display: inline-block;
    min-width: 64px;
    margin-bottom: 4px;
    padding: 2px 10px 1px;
    border-top: 1px solid rgba(239, 208, 138, 0.62);
    border-bottom: 1px solid rgba(239, 208, 138, 0.35);
    background: linear-gradient(
      90deg,
      transparent,
      rgba(14, 12, 18, 0.88) 18%,
      rgba(14, 12, 18, 0.88) 82%,
      transparent
    );
  }

  .unit-vitals span::before,
  .unit-vitals span::after {
    position: absolute;
    top: 50%;
    width: 5px;
    height: 5px;
    border: 1px solid #efd08a;
    background: #7a2630;
    content: '';
    transform: translateY(-50%) rotate(45deg);
  }

  .unit-vitals.hero span::before,
  .unit-vitals.hero span::after {
    background: #2a4a7a;
  }

  .unit-vitals span::before {
    left: -1px;
  }

  .unit-vitals span::after {
    right: -1px;
  }

  .health-track {
    position: relative;
    height: 8px;
    padding: 2px 6px;
    border: 0;
    background: #17121a;
    clip-path: polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%);
    box-shadow: inset 0 0 0 2px #120b0d;
  }

  .health-track::before {
    position: absolute;
    inset: 1px;
    border: 1px solid rgba(239, 208, 138, 0.72);
    clip-path: inherit;
    content: '';
    pointer-events: none;
  }

  .health-track::after {
    position: absolute;
    inset: 2px 6px;
    background: repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent calc(20% - 1px),
      rgba(28, 8, 12, 0.45) calc(20% - 1px),
      rgba(28, 8, 12, 0.45) 20%
    );
    content: '';
    pointer-events: none;
  }

  .health-track i {
    display: block;
    height: 100%;
    transition: width 160ms cubic-bezier(0.2, 0.9, 0.2, 1);
  }

  .unit-vitals.hero .health-track i {
    background:
      linear-gradient(180deg, rgba(200, 230, 255, 0.55), transparent 38%),
      linear-gradient(90deg, #2f6fb8, #6eb0ef 72%, #c5e4ff);
    box-shadow:
      0 0 5px rgba(80, 150, 220, 0.4),
      inset 0 -1px 0 rgba(16, 40, 73, 0.65);
  }

  .unit-vitals.foe .health-track i {
    background:
      linear-gradient(180deg, rgba(255, 226, 153, 0.55), transparent 38%),
      linear-gradient(90deg, #8f2632, #d9463e 72%, #f08050);
    box-shadow:
      0 0 5px rgba(224, 69, 60, 0.4),
      inset 0 -1px 0 rgba(73, 16, 25, 0.65);
  }

  .unit-vitals.targeted {
    filter:
      drop-shadow(0 0 6px rgba(255, 224, 138, 0.9))
      drop-shadow(0 3px 1px rgba(8, 6, 9, 0.58));
  }

  /* Compact strip centered above the hex field (board-anchored, not edge-anchored). */
  .battle-roster {
    position: absolute;
    top: 7.35rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.55rem;
    width: min(22rem, calc(100% - 1.25rem));
    pointer-events: none;
  }

  .side {
    list-style: none;
    margin: 0;
    padding: 0.18rem 0.28rem;
    flex: 1 1 0;
    min-width: 0;
    max-width: 10.5rem;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 2px;
    border-top: 2px solid var(--gold, #efd08a);
    background: rgba(8, 14, 24, 0.72);
    color: #f0e4c8;
    font-family: var(--font-ui);
    font-size: 0.45rem;
    letter-spacing: 0.03em;
    text-shadow: var(--hud-shadow);
    backdrop-filter: blur(6px);
    box-shadow: 0 4px 12px rgba(8, 10, 18, 0.4);
  }

  .side li {
    display: flex;
    align-items: center;
    gap: 0.28rem;
  }

  .side li + li {
    margin-top: 0.1rem;
  }

  .side strong {
    flex: 0 0 3.4rem;
    margin: 0;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .side small {
    flex: 0 0 auto;
    color: rgba(240, 228, 200, 0.68);
    font-size: 0.38rem;
    white-space: nowrap;
  }

  .bar {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    height: 0.2rem;
    border-radius: 1px;
    background: rgba(0, 0, 0, 0.45);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .bar::after {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent calc(25% - 1px),
      rgba(0, 0, 0, 0.35) calc(25% - 1px),
      rgba(0, 0, 0, 0.35) 25%
    );
    content: '';
    pointer-events: none;
  }

  .bar i {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #2f6fb8, #8ec8ff);
  }

  .foes .bar i {
    background: linear-gradient(90deg, #a8323a, #e08a7a);
  }

  @media (max-width: 720px) {
    .unit-vitals {
      width: 82px;
      font-size: 0.42rem;
    }

    .health-track {
      height: 8px;
      padding: 2px 5px;
    }

    .battle-roster {
      top: 7.1rem;
      width: min(20rem, calc(100% - 0.8rem));
      gap: 0.35rem;
    }

    .side {
      padding: 0.14rem 0.22rem;
      font-size: 0.4rem;
    }

    .side strong {
      flex-basis: 2.8rem;
    }

    .start-battle {
      bottom: 1.25rem;
      padding: 0.52rem 1.1rem;
      font-size: 0.82rem;
      letter-spacing: 0.1em;
    }

    .formation-preview {
      bottom: 4.8rem;
      min-width: 10rem;
    }

    .battle-hint {
      font-size: 0.56rem;
      padding: 0.22rem 0.5rem;
      max-width: calc(100vw - 2rem);
      white-space: normal;
      text-align: center;
    }
  }
</style>
