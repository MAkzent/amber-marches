<script lang="ts">
  import { onDestroy } from 'svelte'
  import { sceneLoading } from '../world/sceneLoading'

  const MIN_DISPLAY_MS = 700
  const EXIT_MS = 620

  const startedAt = performance.now()
  let visible = $state(true)
  let leaving = $state(false)
  let releaseScheduled = false
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  const percent = $derived(
    Math.round(Math.min(1, Math.max(0, $sceneLoading.progress)) * 100),
  )
  const status = $derived.by(() => {
    if ($sceneLoading.failed > 0) return 'Mending a broken trail'
    if (percent < 18) return 'Charting the vale'
    if (percent < 44) return 'Growing the wilds'
    if (percent < 72) return 'Gathering the party'
    if (percent < 96) return 'Lighting the road'
    return 'Opening the gates'
  })

  $effect(() => {
    if ($sceneLoading.active || $sceneLoading.total === 0 || releaseScheduled) return

    releaseScheduled = true
    const remaining = Math.max(0, MIN_DISPLAY_MS - (performance.now() - startedAt))
    releaseTimer = setTimeout(() => {
      leaving = true
      hideTimer = setTimeout(() => {
        visible = false
      }, EXIT_MS)
    }, remaining)
  })

  onDestroy(() => {
    if (releaseTimer) clearTimeout(releaseTimer)
    if (hideTimer) clearTimeout(hideTimer)
  })
</script>

{#if visible}
  <section
    class="scene-loader"
    class:is-leaving={leaving}
    data-testid="scene-loader"
    role="status"
    aria-label="Loading Amber Marches"

    aria-live="polite"
  >
    <div class="sky-glow" aria-hidden="true"></div>
    <div class="landscape" aria-hidden="true">
      <i class="sun"></i>
      <i class="ridge ridge-far"></i>
      <i class="ridge ridge-near"></i>
      <i class="road"></i>
    </div>
    <div class="screen-texture" aria-hidden="true"></div>

    <div class="loader-lockup">
      <span class="chapter">Prologue</span>
      <div class="crest" aria-hidden="true">
        <span></span>
      </div>
      <div class="title" aria-hidden="true">
        <span>Amber</span>
        <em>Marches</em>
      </div>

      <div class="loading-copy">
        <span>{status}</span>
        <i aria-hidden="true"></i>
        <i aria-hidden="true"></i>
        <i aria-hidden="true"></i>
      </div>

      <div
        class="meter"
        role="progressbar"
        aria-label="Scene loading progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percent}
      >
        <div class="meter-fill" style={`width: ${percent}%`}>
          <span aria-hidden="true"></span>
        </div>
      </div>
      <div class="meter-caption" aria-hidden="true">
        <span>
          {$sceneLoading.total > 0
            ? `${$sceneLoading.loaded} / ${$sceneLoading.total} assets`
            : 'Preparing the road'}
        </span>
        <strong>{percent}%</strong>
      </div>
    </div>
  </section>
{/if}

<style>
  .scene-loader {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    overflow: hidden;
    color: #fff7e4;
    background:
      radial-gradient(circle at 50% 38%, rgba(207, 105, 65, 0.2), transparent 30%),
      linear-gradient(180deg, #172431 0%, #243c45 46%, #17252b 72%, #090d15 100%);
    clip-path: inset(0);
    opacity: 1;
    transition:
      clip-path 620ms cubic-bezier(0.76, 0, 0.24, 1),
      opacity 520ms ease 80ms;
    pointer-events: auto;
  }

  .scene-loader.is-leaving {
    clip-path: inset(0 0 100% 0);
    opacity: 0;
  }

  .sky-glow {
    position: absolute;
    top: 12%;
    left: 50%;
    width: min(68vw, 760px);
    aspect-ratio: 1.8;
    translate: -50% 0;
    border-radius: 50%;
    background: rgba(239, 208, 138, 0.12);
    filter: blur(45px);
  }

  .landscape {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .sun {
    position: absolute;
    top: 18%;
    left: 58%;
    width: clamp(82px, 11vw, 150px);
    aspect-ratio: 1;
    border: 3px solid rgba(255, 235, 183, 0.55);
    border-radius: 50%;
    background: #d98452;
    box-shadow:
      0 0 0 8px rgba(217, 132, 82, 0.09),
      0 0 70px rgba(239, 183, 102, 0.2);
  }

  .ridge {
    position: absolute;
    right: -8%;
    bottom: 0;
    left: -8%;
    display: block;
  }

  .ridge-far {
    height: 53%;
    background: #263b40;
    clip-path: polygon(
      0 45%,
      11% 28%,
      17% 38%,
      29% 8%,
      37% 31%,
      48% 16%,
      57% 38%,
      68% 12%,
      76% 31%,
      87% 18%,
      100% 40%,
      100% 100%,
      0 100%
    );
  }

  .ridge-near {
    height: 38%;
    background: #14272a;
    clip-path: polygon(
      0 42%,
      13% 22%,
      25% 48%,
      38% 18%,
      52% 44%,
      65% 16%,
      79% 39%,
      91% 19%,
      100% 31%,
      100% 100%,
      0 100%
    );
  }

  .road {
    position: absolute;
    bottom: -4%;
    left: 50%;
    width: min(42vw, 520px);
    height: 37%;
    translate: -50% 0;
    background: linear-gradient(90deg, #263332, #465045 48%, #263332);
    clip-path: polygon(47% 0, 53% 0, 100% 100%, 0 100%);
    opacity: 0.66;
  }

  .screen-texture {
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(
        0deg,
        transparent 0,
        transparent 3px,
        rgba(255, 255, 255, 0.018) 3px,
        rgba(255, 255, 255, 0.018) 4px
      ),
      radial-gradient(circle, transparent 44%, rgba(3, 7, 12, 0.55) 100%);
    pointer-events: none;
  }

  .loader-lockup {
    position: relative;
    z-index: 1;
    width: min(420px, calc(100vw - 48px));
    display: flex;
    flex-direction: column;
    align-items: center;
    filter: drop-shadow(0 8px 22px rgba(3, 7, 12, 0.5));
  }

  .chapter {
    margin-bottom: 18px;
    color: rgba(255, 239, 208, 0.68);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.25em;
    text-transform: uppercase;
  }

  .crest {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    margin-bottom: 18px;
    border: 2px solid rgba(255, 239, 208, 0.85);
    background: #b8493f;
    rotate: 45deg;
    box-shadow:
      inset 0 0 0 5px rgba(76, 24, 27, 0.28),
      4px 4px 0 rgba(4, 8, 12, 0.25);
  }

  .crest::before,
  .crest::after,
  .crest span::before,
  .crest span::after {
    content: '';
    position: absolute;
    background: #ffe4a4;
  }

  .crest::before {
    width: 5px;
    height: 30px;
    rotate: -45deg;
  }

  .crest::after {
    width: 24px;
    height: 5px;
    rotate: -45deg;
  }

  .crest span::before {
    width: 8px;
    height: 8px;
    translate: -4px -4px;
    rotate: -45deg;
  }

  .crest span::after {
    width: 2px;
    height: 38px;
    translate: -1px -19px;
    rotate: -45deg;
    opacity: 0.45;
  }

  .title {
    color: #fff;
    font-size: clamp(3.2rem, 8.6vw, 5.8rem);
    font-weight: 700;
    line-height: 0.72;
    letter-spacing: -0.045em;
    text-align: center;
    text-transform: uppercase;
    text-shadow: 0 3px 0 rgba(5, 9, 14, 0.45);
  }

  .title span,
  .title em {
    display: block;
  }

  .title em {
    margin-left: 0.62em;
    color: #efd08a;
    font-style: normal;
  }

  .loading-copy {
    min-width: 210px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    margin: 34px 0 10px;
    color: rgba(255, 247, 228, 0.78);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .loading-copy i {
    width: 4px;
    height: 4px;
    margin-top: 1px;
    background: #efd08a;
    animation: loader-pip 1.05s steps(2, end) infinite;
  }

  .loading-copy i:nth-of-type(2) {
    animation-delay: 180ms;
  }

  .loading-copy i:nth-of-type(3) {
    animation-delay: 360ms;
  }

  .meter {
    width: 100%;
    height: 15px;
    padding: 3px;
    border: 2px solid rgba(255, 239, 208, 0.7);
    background: rgba(4, 9, 14, 0.58);
    box-shadow: 0 3px 0 rgba(3, 6, 10, 0.28);
  }

  .meter-fill {
    position: relative;
    height: 100%;
    min-width: 0;
    overflow: visible;
    background:
      repeating-linear-gradient(
        90deg,
        #d35e48 0,
        #d35e48 14px,
        #9f3e38 14px,
        #9f3e38 16px
      );
    transition: width 180ms steps(5, end);
  }

  .meter-fill span {
    position: absolute;
    top: -5px;
    right: -2px;
    width: 3px;
    height: 13px;
    background: #fff0b8;
    box-shadow: 0 0 12px #f7c96e;
  }

  .meter-caption {
    width: 100%;
    display: flex;
    justify-content: space-between;
    margin-top: 7px;
    color: rgba(255, 239, 208, 0.48);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .meter-caption strong {
    color: rgba(255, 239, 208, 0.82);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }

  @keyframes loader-pip {
    0%,
    24% {
      opacity: 0.25;
      translate: 0 0;
    }
    25%,
    64% {
      opacity: 1;
      translate: 0 -2px;
    }
    65%,
    100% {
      opacity: 0.25;
      translate: 0 0;
    }
  }

  @media (max-width: 560px) {
    .loader-lockup {
      width: min(340px, calc(100vw - 38px));
    }

    .chapter {
      margin-bottom: 14px;
      font-size: 0.6rem;
    }

    .crest {
      width: 50px;
      height: 50px;
      margin-bottom: 16px;
    }

    .title {
      font-size: clamp(3rem, 16vw, 4.3rem);
    }

    .loading-copy {
      margin-top: 30px;
      font-size: 0.65rem;
    }

    .sun {
      top: 16%;
      left: 66%;
    }
  }

  @media (max-height: 540px) and (orientation: landscape) {
    .loader-lockup {
      scale: 0.75;
    }

    .crest {
      margin-bottom: 14px;
    }

    .loading-copy {
      margin-top: 25px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scene-loader {
      transition: opacity 80ms linear;
    }

    .scene-loader.is-leaving {
      clip-path: none;
    }

    .loading-copy i {
      animation: none;
      opacity: 0.7;
    }

    .meter-fill {
      transition: none;
    }
  }
</style>
