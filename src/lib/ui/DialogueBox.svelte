<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import { converseTuning } from '../world/camera/converseTuning'
  import {
    advanceDialogue,
    dialogueAnchor,
    reducedMotion,
    type ActiveDialogue,
  } from '../world/worldState'

  type Props = {
    session: ActiveDialogue
  }

  let { session }: Props = $props()

  const CHAR_MS = 24
  const line = $derived(session.discovery.dialogue?.[session.lineIndex])
  const speaker = $derived(line?.speaker ?? session.discovery.title)
  const fullText = $derived(line?.text ?? '')
  const ready = $derived(session.ready)
  const lineCount = $derived(session.discovery.dialogue?.length ?? 1)
  const lineLabel = $derived(`${session.lineIndex + 1} / ${lineCount}`)
  const bubbleStyle = $derived(
    [
      `width:min(${$converseTuning.bubbleWidth}px, 82vw)`,
      `height:${$converseTuning.bubbleHeight}px`,
    ].join(';'),
  )

  let revealed = $state('')
  let complete = $state(false)
  let typeTimer: ReturnType<typeof setInterval> | undefined
  let bubbleEl: HTMLDivElement | undefined = $state()

  function clearTypeTimer() {
    if (typeTimer !== undefined) {
      clearInterval(typeTimer)
    }
    typeTimer = undefined
  }

  function finishLine() {
    clearTypeTimer()
    revealed = fullText
    complete = true
  }

  function startTypewriter(text: string) {
    clearTypeTimer()
    revealed = ''
    complete = false

    if (!text) {
      complete = true
      return
    }

    if (untrack(() => $reducedMotion)) {
      revealed = text
      complete = true
      return
    }

    let index = 0
    typeTimer = setInterval(() => {
      index += 1
      revealed = text.slice(0, index)
      if (index >= text.length) finishLine()
    }, CHAR_MS)
  }

  function handleAdvance() {
    if (!ready) return
    if (!complete) {
      finishLine()
      return
    }
    advanceDialogue()
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key.toLowerCase() === 'e' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      handleAdvance()
    }
  }

  function syncBubblePosition() {
    const el = bubbleEl
    if (!el) return

    if (!dialogueAnchor.visible) {
      el.style.opacity = '0'
      return
    }

    // Anchor is the tail tip (head). Bubble sits above it, centered horizontally.
    const left = dialogueAnchor.x * 100
    const top = dialogueAnchor.y * 100
    el.style.left = `${left}%`
    el.style.top = `${top}%`
    el.style.opacity = '1'

    // Soft clamp so a near-edge head doesn't shove the card off-screen.
    const parent = el.offsetParent as HTMLElement | null
    if (!parent) return
    const parentW = parent.clientWidth
    const rect = el.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    const margin = 12
    let dx = 0
    let dy = 0
    const localLeft = rect.left - parentRect.left
    const localRight = rect.right - parentRect.left
    const localTop = rect.top - parentRect.top
    if (localLeft < margin) dx = margin - localLeft
    else if (localRight > parentW - margin) dx = parentW - margin - localRight
    if (localTop < margin) dy = margin - localTop
    if (dx !== 0 || dy !== 0) {
      el.style.left = `calc(${left}% + ${dx}px)`
      el.style.top = `calc(${top}% + ${dy}px)`
    }
  }

  $effect(() => {
    if (!ready) {
      clearTypeTimer()
      revealed = ''
      complete = false
      return
    }
    const text = fullText
    void session.lineIndex
    startTypewriter(text)
    return clearTypeTimer
  })

  $effect(() => {
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  // Track the projected head anchor every animation frame (camera writes it each tick).
  $effect(() => {
    if (!ready) return
    let raf = 0
    const tick = () => {
      syncBubblePosition()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })

  onDestroy(clearTypeTimer)
</script>

<button
  type="button"
  class="dialogue-backdrop"
  class:framing={!ready}
  aria-label={ready ? 'Advance dialogue' : 'Camera framing'}
  onclick={handleAdvance}
  transition:fade={{ duration: 240 }}
></button>

{#if ready}
  <div
    bind:this={bubbleEl}
    class="speech-bubble"
    style={bubbleStyle}
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialogue-speaker"
    data-testid="dialogue-box"
    tabindex="-1"
    onclick={handleAdvance}
    onkeydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') handleAdvance()
    }}
    transition:scale={{ start: 0.9, duration: 200 }}
  >
    <div class="panel-frame" aria-hidden="true">
      <i class="corner tl"></i><i class="corner tr"></i>
      <i class="corner bl"></i><i class="corner br"></i>
    </div>
    <header class="bubble-head">
      <span class="title-sigil" aria-hidden="true">◆</span>
      <span class="eyebrow">Conversation</span>
      <span class="line-index">{lineLabel}</span>
    </header>
    <h2 id="dialogue-speaker">{speaker}</h2>
    <p class="speech-text" aria-live="polite">
      {revealed}<span class="caret" class:hidden={complete} aria-hidden="true">▌</span>
    </p>
    <footer class="bubble-foot">
      <span class="footer-rule" aria-hidden="true"></span>
      <span class="continue-btn">
        {#if complete}
          Continue <b>E</b>
        {:else}
          Skip <b>E</b>
        {/if}
      </span>
    </footer>
    <i class="tail" aria-hidden="true"></i>
  </div>
{/if}

<style>
  .dialogue-backdrop {
    position: absolute;
    inset: 0;
    z-index: 34;
    border: 0;
    margin: 0;
    padding: 0;
    cursor: pointer;
    background: radial-gradient(
      ellipse 60% 50% at 50% 45%,
      transparent 0%,
      transparent 55%,
      rgba(8, 12, 22, 0.28) 100%
    );
    pointer-events: auto;
  }

  .dialogue-backdrop.framing {
    cursor: default;
  }

  .speech-bubble {
    position: absolute;
    z-index: 36;
    left: 50%;
    top: 35%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: 14px 16px 12px;
    border: 3px solid rgba(255, 255, 255, 0.28);
    border-radius: 2px;
    color: #f2f4f8;
    background: rgba(6, 10, 18, 0.94);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.65),
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 0 0 1px rgba(201, 169, 110, 0.22),
      0 12px 28px rgba(0, 0, 0, 0.55);
    transform: translate(-50%, calc(-100% - 2px));
    cursor: pointer;
    pointer-events: auto;
    text-align: left;
    opacity: 0;
    overflow: visible;
    will-change: left, top, opacity;
  }

  .speech-bubble::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    border-radius: inherit;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.028) 0px,
        rgba(255, 255, 255, 0.028) 1px,
        transparent 1px,
        transparent 3px
      ),
      linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 22%);
    overflow: hidden;
  }

  .panel-frame {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }

  .corner {
    position: absolute;
    width: 12px;
    height: 12px;
    border: 2px solid #efd08a;
  }

  .corner.tl {
    top: 5px;
    left: 5px;
    border-right: 0;
    border-bottom: 0;
  }

  .corner.tr {
    top: 5px;
    right: 5px;
    border-left: 0;
    border-bottom: 0;
  }

  .corner.bl {
    bottom: 5px;
    left: 5px;
    border-right: 0;
    border-top: 0;
  }

  .corner.br {
    bottom: 5px;
    right: 5px;
    border-left: 0;
    border-top: 0;
  }

  .bubble-head,
  h2,
  .speech-text,
  .bubble-foot {
    position: relative;
    z-index: 1;
  }

  .bubble-head {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
    margin: 0 0 4px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .title-sigil {
    color: #efd08a;
    font-size: 0.72rem;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.55);
  }

  .bubble-head .eyebrow {
    color: rgba(239, 208, 138, 0.88);
    font-family: var(--font-ui);
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.16em;
  }

  .line-index {
    color: rgba(184, 192, 204, 0.85);
    font-family: var(--font-mono);
    font-size: 1.05rem;
    letter-spacing: 0.04em;
  }

  h2 {
    margin: 0 0 8px;
    flex: 0 0 auto;
    font-family: var(--font-ui);
    font-size: 1.08rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fff;
    line-height: 1.1;
    text-transform: uppercase;
    text-shadow: 0 2px 0 rgba(0, 0, 0, 0.65);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .speech-text {
    margin: 0;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    color: rgba(245, 247, 250, 0.96);
    font-family: var(--font-mono);
    font-size: 1.42rem;
    line-height: 1.28;
    letter-spacing: 0.01em;
    text-shadow: 0 2px 0 rgba(0, 0, 0, 0.55);
  }

  .caret {
    color: #efd08a;
    animation: caret-blink 0.7s steps(1) infinite;
  }

  .caret.hidden {
    visibility: hidden;
  }

  .bubble-foot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex: 0 0 auto;
    margin-top: 8px;
  }

  .footer-rule {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(201, 169, 110, 0.5));
  }

  .continue-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: 2px;
    color: #fff;
    background: rgba(8, 14, 24, 0.75);
    font-family: var(--font-ui);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .continue-btn b {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border: 1px solid rgba(239, 208, 138, 0.75);
    border-radius: 2px;
    color: #1a1208;
    background: #efd08a;
    font-family: var(--font-ui);
    font-size: 0.68rem;
    font-weight: 700;
  }

  .tail {
    position: absolute;
    left: 50%;
    bottom: -11px;
    z-index: 1;
    width: 18px;
    height: 11px;
    margin-left: -9px;
    background: rgba(6, 10, 18, 0.94);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.25));
  }

  @keyframes caret-blink {
    50% {
      opacity: 0;
    }
  }

  @media (max-width: 720px), (hover: none) and (pointer: coarse) {
    .speech-text {
      font-size: 1.22rem;
    }

    h2 {
      font-size: 0.95rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .caret {
      animation: none;
    }
  }
</style>
