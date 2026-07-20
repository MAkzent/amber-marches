<script lang="ts">
  import { onMount } from 'svelte'
  import { fly, fade, scale } from 'svelte/transition'
  import {
    activeDialogue,
    activeToast,
    audioEnabled,
    completeNearby,
    discoveryCount,
    introVisible,
    nearbyDiscovery,
    objective,
    playerPosition,
    questSteps,
    resetWorld,
    weatherMode,
    type WeatherMode,
  } from '../world/worldState'
  import { formatCount, perfStats } from '../world/perfStats'
  import { requestAbilitySlot } from '../world/combat'
  import {
    isFullscreenActive,
    subscribeFullscreenChange,
    toggleAppFullscreen,
  } from './fullscreen'
  import DialogueBox from './DialogueBox.svelte'
  import CombatOverlay from './CombatOverlay.svelte'
  import ConverseTuningPanel from './ConverseTuningPanel.svelte'
  import VirtualJoystick from './VirtualJoystick.svelte'

  let showMenu = $state(false)
  let showConverseDev = $state(false)
  let fullscreen = $state(false)
  let fullscreenSupported = $state(true)
  const isDev = import.meta.env.DEV

  onMount(() => {
    fullscreen = isFullscreenActive()
    fullscreenSupported =
      typeof document !== 'undefined' &&
      Boolean(
        document.documentElement.requestFullscreen ||
          (document.documentElement as HTMLElement & { webkitRequestFullscreen?: unknown })
            .webkitRequestFullscreen,
      )
    return subscribeFullscreenChange(() => {
      fullscreen = isFullscreenActive()
    })
  })

  function begin() {
    introVisible.set(false)
  }

  function restart() {
    showMenu = false
    resetWorld()
  }

  async function handleFullscreen() {
    const shell = document.querySelector('.game-shell') as HTMLElement | null
    const ok = await toggleAppFullscreen(shell ?? document.documentElement)
    fullscreen = isFullscreenActive()
    if (!ok && !fullscreen) {
      fullscreenSupported = false
    }
  }

  const weatherOrder: WeatherMode[] = ['sunshower', 'clear', 'fireflies', 'snow']
  const weatherLabel: Record<WeatherMode, string> = {
    sunshower: 'Sunshower',
    clear: 'Leaf-drift',
    fireflies: 'Fireflies',
    snow: 'Snowfall',
  }

  function cycleWeather() {
    weatherMode.update((current) => {
      const index = weatherOrder.indexOf(current)
      return weatherOrder[(index + 1) % weatherOrder.length]
    })
  }
</script>

<div
  class="hud-root"
  class:is-intro={$introVisible}
  class:dialogue-open={Boolean($activeDialogue)}
  data-testid="world-hud"
  data-player-x={$playerPosition[0]}
  data-player-z={$playerPosition[1]}
>
  {#if $introVisible}
    <section class="intro" transition:fade={{ duration: 900 }}>
      <div class="intro-copy">
        <div class="intro-chapter">
          <span class="eyebrow">Prologue</span>
          <span>A new road begins</span>
        </div>
        <h1><span>Sunmere</span><em>Vale</em></h1>
        <p>A quiet borderland where old promises still glow beneath the grass.</p>
        <div class="intro-actions">
          <button class="intro-enter" onclick={begin}>
            <strong>Enter the vale</strong>
            <span class="button-arrow" aria-hidden="true">→</span>
          </button>
          {#if fullscreenSupported}
            <button
              class="fullscreen-button intro-fullscreen"
              aria-pressed={fullscreen}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              onclick={handleFullscreen}
            >
              {fullscreen ? 'Exit full' : 'Fullscreen'}
            </button>
          {/if}
        </div>
        <small class="hint-desktop">WASD or click to move</small>
        <small class="hint-mobile">Touch & drag to travel</small>
      </div>
    </section>
  {:else}
    {#if !$activeDialogue}
      <CombatOverlay />
    {/if}
    <header class="topbar" transition:fade={{ duration: 500 }}>
      <div class="region-mark" aria-label="Current region">
        <span class="sigil" aria-hidden="true">SV</span>
        <div>
          <span class="eyebrow">The Amber Marches</span>
          <strong>Sunmere Vale</strong>
        </div>
      </div>

      <div class="zone-banner" aria-hidden="true">
        <i></i>
        <span>Open World</span>
        <i></i>
      </div>

      <div class="topbar-actions">
        {#if fullscreenSupported}
          <button
            class="round-button fullscreen-button"
            aria-pressed={fullscreen}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onclick={handleFullscreen}
          >
            {fullscreen ? 'Exit' : 'Full'}
          </button>
        {/if}
        <button class="round-button" aria-label="Open settings" onclick={() => (showMenu = !showMenu)}>Menu</button>
      </div>
    </header>

    <aside class="quest-tracker" transition:fly={{ x: -16, duration: 420 }} aria-label="Quest tracker">
      <div class="quest-tracker-head">
        <span class="quest-icon" aria-hidden="true">!</span>
        <div>
          <span class="eyebrow">Active Quest</span>
          <strong>Pilgrim Road</strong>
        </div>
        <b class="quest-count">{$discoveryCount}/5</b>
      </div>
      <p class="quest-objective">{$objective}</p>
      <ul class="quest-steps">
        {#each $questSteps as step}
          <li class:done={step.done}>
            <span class="step-mark" aria-hidden="true">{step.done ? '●' : '○'}</span>
            <span>{step.label}</span>
          </li>
        {/each}
      </ul>
      <div class="resonance-bar" aria-label="Vale resonance">
        <span>Vale resonance</span>
        <div class="pips">
          {#each Array(5) as _, index}
            <i class:lit={index < $discoveryCount}></i>
          {/each}
        </div>
      </div>
    </aside>

    <div class="compass" aria-hidden="true" transition:fade={{ duration: 400 }}>
      <span>W</span><i></i><b>N</b><i></i><span>E</span>
    </div>

    <footer class="controls" transition:fade={{ duration: 400 }}>
      <span><kbd>WASD</kbd> Travel</span>
      <span><kbd>Shift</kbd> Run</span>
      <span><kbd>Space</kbd> Jump</span>
      <span><kbd>E</kbd> Interact</span>
      <span><kbd>1</kbd> Attack</span>
    </footer>

    <footer class="mobile-hint" transition:fade={{ duration: 400 }}>
      <span>Touch & drag to move</span>
      <span>Tap prompt to interact</span>
    </footer>

    <aside class="perf-panel" aria-label="Performance" data-testid="perf-panel" transition:fade={{ duration: 400 }}>
      <div class="perf-fps" data-testid="perf-fps">
        <strong>{$perfStats.fps}</strong>
        <span>FPS</span>
      </div>
      <dl class="perf-metrics">
        <div>
          <dt>MS</dt>
          <dd>{$perfStats.ms.toFixed(1)}</dd>
        </div>
        <div>
          <dt>DRAW</dt>
          <dd>{$perfStats.calls}</dd>
        </div>
        <div>
          <dt>TRIS</dt>
          <dd>{formatCount($perfStats.triangles)}</dd>
        </div>
        <div>
          <dt>GEO</dt>
          <dd>{$perfStats.geometries}</dd>
        </div>
        <div>
          <dt>TEX</dt>
          <dd>{$perfStats.textures}</dd>
        </div>
      </dl>
    </aside>
  {/if}

  {#if !$introVisible && !$activeDialogue}
    <VirtualJoystick />
    <button
      class="combat-attack-button"
      aria-label="Attack"
      onpointerdown={(event) => {
        event.preventDefault()
        requestAbilitySlot(1)
      }}
    >
      <span>1</span>
      <strong>Hit</strong>
    </button>
  {/if}

  {#if !$introVisible && !$activeDialogue && $nearbyDiscovery}
    <button
      class="interaction"
      onclick={completeNearby}
      transition:scale={{ start: 0.86, duration: 180 }}
      aria-label={`${$nearbyDiscovery.action} ${$nearbyDiscovery.title}`}
    >
      <span class="key"><span class="key-desktop">E</span><span class="key-mobile">●</span></span>
      <span>
        <small>{$nearbyDiscovery.action}</small>
        <strong>{$nearbyDiscovery.title}</strong>
      </span>
    </button>
  {/if}

  {#if !$introVisible && $activeDialogue}
    <DialogueBox session={$activeDialogue} />
    {#if isDev && showConverseDev}
      <ConverseTuningPanel />
    {/if}
  {/if}

  {#if !$introVisible && !$activeDialogue && $activeToast}
    <section class="discovery-toast" transition:fly={{ y: 24, duration: 500 }}>
      <span class="crest" aria-hidden="true">✦</span>
      <div>
        <span class="eyebrow">{$activeToast.eyebrow}</span>
        <h2>{$activeToast.title}</h2>
        <p>{$activeToast.description}</p>
      </div>
    </section>
  {/if}

  {#if showMenu}
    <section class="menu" transition:fly={{ x: 16, duration: 220 }}>
      <div class="menu-heading">
        <div>
          <span class="eyebrow">Field menu</span>
          <strong>Journey settings</strong>
        </div>
        <button aria-label="Close settings" onclick={() => (showMenu = false)}>×</button>
      </div>
      {#if fullscreenSupported}
        <button class="menu-row" onclick={handleFullscreen}>
          <span>Display</span>
          <b>{fullscreen ? 'Exit full' : 'Fullscreen'}</b>
        </button>
      {/if}
      <button class="menu-row" onclick={() => audioEnabled.update((value) => !value)}>
        <span>Soundscape</span>
        <b>{$audioEnabled ? 'On' : 'Off'}</b>
      </button>
      <button class="menu-row" onclick={cycleWeather}>
        <span>Valley weather</span>
        <b>{weatherLabel[$weatherMode]}</b>
      </button>
      {#if isDev}
        <button
          class="menu-row"
          onclick={() => {
            showConverseDev = !showConverseDev
            showMenu = false
          }}
        >
          <span>Converse tune</span>
          <b>{showConverseDev ? 'On' : 'Off'}</b>
        </button>
      {/if}
      <button class="menu-row" onclick={restart}>
        <span>Begin again</span>
        <b>Reset</b>
      </button>
      <p>Art uses CC0 environment assets and licensed Minifantasy True Heroes sprites. See asset credits in the project.</p>
    </section>
  {/if}
</div>
