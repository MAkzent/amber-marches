<script lang="ts">
  import {
    CONVERSE_TUNING_DEFAULTS,
    converseTuning,
    resetConverseTuning,
    type ConverseTuning,
  } from '../world/camera/converseTuning'

  type Slider = {
    key: keyof ConverseTuning
    label: string
    min: number
    max: number
    step: number
  }

  type Section = { title: string; sliders: Slider[] }

  const sections: Section[] = [
    {
      title: 'Framing',
      sliders: [
        { key: 'clusterNdcX', label: 'Screen center X', min: -1, max: 1, step: 0.01 },
        { key: 'clusterNdcY', label: 'Screen center Y', min: -0.8, max: 0.8, step: 0.01 },
      ],
    },
    {
      title: 'Party ↔ speaker',
      sliders: [
        { key: 'partyWeight', label: 'Mix (0 speaker → 1 party)', min: 0, max: 1, step: 0.01 },
        { key: 'speakerPull', label: 'Pull along party→NPC', min: -1.5, max: 1.5, step: 0.01 },
        { key: 'lateralBias', label: 'Lateral bias (cam-right)', min: -6, max: 6, step: 0.05 },
      ],
    },
    {
      title: 'Camera',
      sliders: [
        { key: 'converseDist', label: 'Distance', min: 8, max: 32, step: 0.1 },
        { key: 'dolly', label: 'Dolly', min: 0.4, max: 2, step: 0.01 },
        { key: 'converseHeight', label: 'Camera height', min: 1, max: 18, step: 0.1 },
        { key: 'converseLookY', label: 'Look height', min: 0.2, max: 6, step: 0.05 },
        { key: 'yawOffset', label: 'Yaw orbit °', min: -90, max: 90, step: 1 },
        { key: 'pitchOffset', label: 'Pitch tilt °', min: -35, max: 45, step: 1 },
        { key: 'fov', label: 'FOV', min: 24, max: 55, step: 0.5 },
        { key: 'converseStrength', label: 'Converse blend', min: 0.15, max: 1, step: 0.01 },
        { key: 'perchSideNudge', label: 'Side nudge', min: 0, max: 0.8, step: 0.01 },
      ],
    },
    {
      title: 'Speech bubble',
      sliders: [
        { key: 'bubbleWidth', label: 'Bubble width', min: 280, max: 460, step: 4 },
        { key: 'bubbleHeight', label: 'Bubble height', min: 160, max: 260, step: 2 },
        { key: 'bubbleHeadY', label: 'Head height', min: 2.5, max: 6.5, step: 0.05 },
        { key: 'bubbleSideX', label: 'Side X', min: -2, max: 2, step: 0.05 },
        { key: 'bubbleSideZ', label: 'Side Z', min: -2, max: 2, step: 0.05 },
      ],
    },
  ]

  function setValue(key: keyof ConverseTuning, raw: string) {
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    converseTuning.update((current) => ({ ...current, [key]: value }))
  }

  function formatValue(key: keyof ConverseTuning, step: number) {
    const value = $converseTuning[key]
    return value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)
  }

  function copyValues() {
    const t = $converseTuning
    const text = Object.entries(t)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
    void navigator.clipboard?.writeText(text)
  }
</script>

<aside class="tuning-panel" data-testid="converse-tuning">
  <header class="tuning-head">
    <div>
      <span class="eyebrow">Camera rig</span>
      <strong>Converse tune</strong>
    </div>
    <div class="tuning-actions">
      <button type="button" onclick={copyValues}>Copy</button>
      <button type="button" onclick={resetConverseTuning}>Reset</button>
    </div>
  </header>

  {#each sections as section}
    <section class="tuning-section">
      <h3>{section.title}</h3>
      <div class="tuning-list">
        {#each section.sliders as slider}
          <label class="tuning-row">
            <span>
              {slider.label}
              <b>{formatValue(slider.key, slider.step)}</b>
            </span>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={$converseTuning[slider.key]}
              oninput={(event) => setValue(slider.key, event.currentTarget.value)}
            />
          </label>
        {/each}
      </div>
    </section>
  {/each}

  <p class="tuning-hint">
    Dev rig · Reset restores shipped defaults · NDC {CONVERSE_TUNING_DEFAULTS.clusterNdcX}
  </p>
</aside>

<style>
  .tuning-panel {
    position: fixed;
    z-index: 48;
    top: calc(72px + env(safe-area-inset-top, 0px));
    right: max(14px, env(safe-area-inset-right, 0px));
    width: min(300px, calc(100vw - 28px));
    max-height: calc(100dvh - 96px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
    overflow: auto;
    padding: 12px 12px 10px;
    border: 2px solid rgba(232, 196, 120, 0.45);
    border-radius: 4px;
    color: #f3ead8;
    background: rgba(12, 16, 26, 0.92);
    box-shadow:
      inset 0 0 0 1px rgba(255, 220, 160, 0.08),
      0 16px 36px rgba(4, 8, 16, 0.45);
    backdrop-filter: blur(12px);
    pointer-events: auto;
  }

  @media (pointer: coarse) {
    .tuning-panel {
      backdrop-filter: none;
    }
  }

  .tuning-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }

  .tuning-head strong {
    display: block;
    margin-top: 3px;
    font-family: 'Pixelify Sans', 'VT323', monospace;
    font-size: 0.95rem;
    letter-spacing: 0.03em;
    color: #f0d28a;
  }

  .tuning-actions {
    display: flex;
    gap: 6px;
  }

  .tuning-actions button {
    padding: 4px 8px;
    border: 1px solid rgba(201, 169, 110, 0.55);
    border-radius: 2px;
    color: #e8c478;
    background: rgba(28, 34, 48, 0.9);
    cursor: pointer;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tuning-actions button:hover {
    border-color: #e8c478;
  }

  .tuning-section {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(201, 169, 110, 0.22);
  }

  .tuning-section h3 {
    margin: 0 0 8px;
    color: rgba(232, 196, 120, 0.78);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .tuning-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tuning-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    color: rgba(238, 230, 214, 0.82);
  }

  .tuning-row span {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .tuning-row b {
    color: #e8c478;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .tuning-row input[type='range'] {
    width: 100%;
    accent-color: #c9a96e;
  }

  .tuning-hint {
    margin: 10px 0 0;
    color: rgba(174, 180, 189, 0.65);
    font-size: 0.58rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  @media (max-width: 720px), (hover: none) and (pointer: coarse) {
    .tuning-panel {
      top: auto;
      bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      right: max(10px, env(safe-area-inset-right, 0px));
      left: auto;
      width: min(280px, calc(100vw - 20px));
      max-height: 42dvh;
    }
  }
</style>
