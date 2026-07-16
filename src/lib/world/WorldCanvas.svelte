<script lang="ts">
  import { Canvas } from '@threlte/core'
  import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three'
  import { weatherMode } from './worldState'
  import WorldScene from './WorldScene.svelte'

  function createRenderer(canvas: HTMLCanvasElement) {
    const renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.03
    return renderer
  }
</script>

<div class="world-canvas" class:is-snow={$weatherMode === 'snow'} data-testid="world-canvas">
  <Canvas
    {createRenderer}
    shadows={PCFShadowMap}
    dpr={[0.82, 1.15]}
    renderMode="always"
  >
    <WorldScene />
  </Canvas>
  <div class="atmospheric-wash"></div>
</div>

<style>
  .world-canvas {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #6e9b95;
    image-rendering: pixelated;
  }

  .world-canvas.is-snow {
    background: #8a9eb0;
  }

  .world-canvas :global(canvas) {
    image-rendering: pixelated;
  }

  .atmospheric-wash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 26% 10%, rgba(255, 218, 134, 0.2), transparent 38%),
      linear-gradient(to bottom, rgba(255, 224, 157, 0.1), transparent 42%),
      linear-gradient(to top, rgba(36, 62, 52, 0.05), transparent 34%);
    mix-blend-mode: soft-light;
    transition: background 1.2s ease;
  }

  .world-canvas.is-snow .atmospheric-wash {
    background:
      radial-gradient(circle at 30% 8%, rgba(220, 236, 255, 0.28), transparent 42%),
      linear-gradient(to bottom, rgba(190, 214, 236, 0.16), transparent 48%),
      linear-gradient(to top, rgba(48, 68, 82, 0.12), transparent 36%);
  }
</style>
