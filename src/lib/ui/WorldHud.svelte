<script lang="ts">
  import { onMount } from 'svelte'
  import { fly, fade, scale } from 'svelte/transition'
  import {
    activeToast,
    audioEnabled,
    completeNearby,
    discoveryCount,
    introVisible,
    nearbyDiscovery,
    objective,
    playerPosition,
    resetWorld,
    weatherMode,
    type WeatherMode,
  } from '../world/worldState'
  import {
    isFullscreenActive,
    subscribeFullscreenChange,
    toggleAppFullscreen,
  } from './fullscreen'
  import VirtualJoystick from './VirtualJoystick.svelte'

  let showMenu = $state(false)
  let fullscreen = $state(false)
  let fullscreenSupported = $state(true)

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

  const weatherOrder: WeatherMode[] = ['sunshower', 'clear', 'fireflies']
  const weatherLabel: Record<WeatherMode, string> = {
    sunshower: 'Sunshower',
    clear: 'Leaf-drift',
    fireflies: 'Fireflies',
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
    <header class="topbar" transition:fade={{ duration: 500 }}>
      <div class="region-mark" aria-label="Current region">
        <span class="sigil" aria-hidden="true">SV</span>
        <div>
          <span class="eyebrow">The Amber Marches</span>
          <strong>Sunmere Vale</strong>
        </div>
      </div>

      <div class="progress" aria-label="Discovery progress">
        <span>Vale resonance</span>
        <div class="pips">
          {#each Array(5) as _, index}
            <i class:lit={index < $discoveryCount}></i>
          {/each}
        </div>
        <b><span>{$discoveryCount}</span> / 5</b>
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

    <aside class="objective-card" transition:fly={{ x: -12, duration: 420 }}>
      <div>
        <span class="eyebrow">Current objective</span>
        <p>{$objective}</p>
      </div>
    </aside>

    <div class="mobile-progress" aria-label="Discovery progress">
      <div class="pips">
        {#each Array(5) as _, index}
          <i class:lit={index < $discoveryCount}></i>
        {/each}
      </div>
      <b>{$discoveryCount}/5</b>
    </div>

    <div class="compass" aria-hidden="true" transition:fade={{ duration: 400 }}>
      <span>W</span><i></i><b>N</b><i></i><span>E</span>
    </div>

    <footer class="controls" transition:fade={{ duration: 400 }}>
      <span><kbd>WASD</kbd> Travel</span>
      <span><kbd>Shift</kbd> Run</span>
      <span><kbd>E</kbd> Interact</span>
    </footer>

    <footer class="mobile-hint" transition:fade={{ duration: 400 }}>
      <span>Touch & drag to move</span>
      <span>Tap prompt to interact</span>
    </footer>
  {/if}

  <VirtualJoystick />

  {#if !$introVisible && $nearbyDiscovery}
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

  {#if !$introVisible && $activeToast}
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
      <button class="menu-row" onclick={restart}>
        <span>Begin again</span>
        <b>Reset</b>
      </button>
      <p>Art uses CC0 environment assets and licensed Minifantasy True Heroes sprites. See asset credits in the project.</p>
    </section>
  {/if}
</div>
