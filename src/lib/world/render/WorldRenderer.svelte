<script lang="ts">
  import { onDestroy } from 'svelte'
  import { useThrelte } from '@threlte/core'
  import { Uniform, Vector2, Vector4 } from 'three'
  import {
    BloomEffect,
    BlendFunction,
    Effect,
    EffectComposer,
    EffectPass,
    KernelSize,
    NormalPass,
    RenderPass,
    SSAOEffect,
    VignetteEffect,
  } from 'postprocessing'
  import { get } from 'svelte/store'
  import { cameraMode, combatLive, graphicsTier, reducedMotion } from '../worldState'
  import { samplePerf } from '../perfStats'
  import { calculatePixelGrid } from './pixelGrid'
  import { createSoftTiltShiftEffect } from './softTiltShift'
  import { combatImpact } from '../combat'
  import { battleHud } from '../battle'

  const isMobile = get(graphicsTier) === 'mobile'

  const CSS_PIXEL_SIZE = 2
  const EXPLORE_VIGNETTE_DARKNESS = 0.26
  const EXPLORE_VIGNETTE_OFFSET = 0.32
  /** Combat vignette — soft edge crush, no tilt-shift blur. */
  const COMBAT_VIGNETTE_DARKNESS = 0.69
  const COMBAT_VIGNETTE_OFFSET = 0.4
  /** Wider focus + feather so explore blur eases in without a hard seam. */
  const EXPLORE_TILT_FOCUS = 0.66
  const EXPLORE_TILT_FEATHER = 0.48
  const EXPLORE_TILT_OFFSET = 0.045
  /** Full-frame focus kills tilt-shift blur during combat. */
  const COMBAT_TILT_FOCUS = 1
  const COMBAT_TILT_FEATHER = 0

  class SunmereHd2dEffect extends Effect {
    private readonly pixelGrid: Uniform<Vector4>
    private readonly pixelSize: Uniform<number>

    constructor() {
      const pixelGrid = new Uniform(new Vector4())
      const pixelSize = new Uniform(CSS_PIXEL_SIZE)

      super(
        'SunmereHd2dGrade',
        `
          uniform float pixelSize;
          uniform vec4 pixelGrid;

          void mainUv(inout vec2 uv) {
            uv = pixelGrid.xy * (floor(uv * pixelGrid.zw) + 0.5);
          }

          float bayer2(vec2 pixel) {
            return mod(pixel.x * 2.0 + pixel.y * 3.0, 4.0);
          }

          float bayer4(vec2 pixel) {
            vec2 p = mod(floor(pixel), 4.0);
            return (
              bayer2(mod(p, 2.0)) * 4.0 +
              bayer2(floor(p * 0.5))
            ) / 16.0;
          }

          void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
            vec3 color = inputColor.rgb;
            float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

            // Continuous split-toning keeps color stable during camera motion.
            // This carries the warm PS2-era grade without nearest-palette pops.
            color = (color - 0.5) * 1.04 + 0.53;
            color = mix(vec3(luma), color, 1.14);
            float shadow = 1.0 - smoothstep(0.04, 0.42, luma);
            float light = smoothstep(0.38, 0.9, luma);
            color += vec3(0.012, 0.021, 0.02) * shadow;
            color *= mix(vec3(1.0), vec3(1.075, 1.025, 0.91), light * 0.46);
            color += vec3(0.021, 0.011, 0.003) * light;
            color = clamp(color, 0.0, 1.0);

            float halation = smoothstep(0.6, 0.94, luma);
            color += vec3(0.055, 0.026, 0.006) * halation;

            // Nostalgic texture is luminance-only and applied after grading.
            // It cannot push a pixel into a different hue or palette cell.
            vec2 pixel = floor(gl_FragCoord.xy / pixelSize);
            float ordered = bayer4(pixel) - 0.5;
            float midtone = 1.0 - abs(luma * 2.0 - 1.0);
            float orderedTexture = ordered * mix(0.003, 0.007, midtone);
            float scanline = mix(-0.0035, 0.0035, step(1.0, mod(pixel.y, 2.0)));
            color = clamp(color + vec3(orderedTexture + scanline), 0.0, 1.0);
            outputColor = vec4(color, inputColor.a);
          }
        `,
        {
          blendFunction: BlendFunction.NORMAL,
          uniforms: new Map<string, Uniform>([
            ['pixelSize', pixelSize],
            ['pixelGrid', pixelGrid],
          ]),
        },
      )

      this.pixelGrid = pixelGrid
      this.pixelSize = pixelSize
    }

    setSize(width: number, height: number) {
      const grid = calculatePixelGrid(
        width,
        height,
        renderer.getPixelRatio(),
        CSS_PIXEL_SIZE,
      )
      this.pixelGrid.value.set(
        grid.cellUvX,
        grid.cellUvY,
        grid.columns,
        grid.rows,
      )
      this.pixelSize.value = grid.framebufferPixelSize
    }
  }

  const { scene, renderer, camera, autoRender, renderStage } = useThrelte()
  const composer = new EffectComposer(renderer, { multisampling: 0 })
  const renderPass = new RenderPass(scene, camera.current)
  const normalPass = isMobile
    ? null
    : new NormalPass(scene, camera.current, {
        resolutionScale: 0.5,
      })
  const ambientOcclusion =
    isMobile || !normalPass
      ? null
      : new SSAOEffect(camera.current, normalPass.texture, {
          blendFunction: BlendFunction.MULTIPLY,
          samples: 4,
          rings: 2,
          radius: 0.065,
          intensity: 1.08,
          luminanceInfluence: 0.84,
        })
  const bloom = new BloomEffect({
    intensity: isMobile ? 0.34 : 0.52,
    luminanceThreshold: 0.62,
    luminanceSmoothing: 0.38,
    mipmapBlur: true,
    // Fewer MIP RTs — heavy particle weather was exhausting GPU memory and
    // leaking half-res bloom tiles as solid yellow rectangles.
    // Mobile: fewer levels to cut fill-rate / RT cost.
    levels: isMobile ? 3 : 5,
  })
  const tiltShift = isMobile
    ? null
    : createSoftTiltShiftEffect({
        offset: EXPLORE_TILT_OFFSET,
        focusArea: EXPLORE_TILT_FOCUS,
        feather: EXPLORE_TILT_FEATHER,
        kernelSize: KernelSize.VERY_SMALL,
        resolutionScale: 0.55,
      })
  const hd2dGrade = new SunmereHd2dEffect()
  const vignette = new VignetteEffect({
    darkness: 0.26,
    offset: 0.32,
  })
  // CRITICAL: keep mainUv pixel-grid (hd2dGrade) off the bloom/tilt pass.
  // postprocessing feeds the same UV into every mainImage in a merged pass, so
  // quantizing UV while bloom/tilt sample their half-res maps paints those
  // maps as hard rectangular slabs — the yellow “arrow area” glitch.
  const lightingPass = isMobile
    ? new EffectPass(camera.current, bloom)
    : new EffectPass(camera.current, ambientOcclusion!, bloom, tiltShift!)
  const gradePass = new EffectPass(camera.current, hd2dGrade, vignette)
  composer.addPass(renderPass)
  if (normalPass) composer.addPass(normalPass)
  composer.addPass(lightingPass)
  composer.addPass(gradePass)

  const rendererSize = new Vector2()
  const drawingBufferSize = new Vector2()
  let composerBufferWidth = 0
  let composerBufferHeight = 0

  function syncComposerSize() {
    renderer.getDrawingBufferSize(drawingBufferSize)
    if (
      drawingBufferSize.x === composerBufferWidth &&
      drawingBufferSize.y === composerBufferHeight
    ) {
      return
    }

    renderer.getSize(rendererSize)
    composer.setSize(rendererSize.x, rendererSize.y, false)
    composerBufferWidth = drawingBufferSize.x
    composerBufferHeight = drawingBufferSize.y
  }

  const previousAutoRender = autoRender.current
  const previousInfoAutoReset = renderer.info.autoReset
  renderer.info.autoReset = false
  autoRender.set(false)
  /** Eased 0..1 so dialogue vignette matches combat punch-in / soft release. */
  let converseVignette = 0
  let impactSerial = combatImpact.serial
  let impactFlash = 0
  const task = renderStage.createTask(
    Symbol('storybook-postprocessing'),
    (delta) => {
      // Threlte owns canvas layout and resizes its renderer before this stage.
      // Compare physical buffer dimensions so CSS size, DPR, orientation and
      // fullscreen changes all update every post-processing render target.
      syncComposerSize()
      renderPass.mainCamera = camera.current
      if (normalPass) normalPass.mainCamera = camera.current
      lightingPass.mainCamera = camera.current
      gradePass.mainCamera = camera.current

      const modeKind = get(cameraMode).kind
      const wantConverse = modeKind === 'converse' ? 1 : 0
      // Hex battle: light vignette only — board stays open, not crushed.
      const wantBattle = get(battleHud).stageBlend * 0.22
      if (combatImpact.serial !== impactSerial) {
        impactSerial = combatImpact.serial
        impactFlash = $reducedMotion ? 0.14 : 0.7 * combatImpact.strength
      }
      impactFlash *= Math.pow(0.00008, delta)
      bloom.intensity = (isMobile || $reducedMotion ? 0.34 : 0.52) + impactFlash * 0.28
      if ($reducedMotion) {
        converseVignette = Math.max(wantConverse, wantBattle)
      } else {
        const target = Math.max(wantConverse, wantBattle)
        const ease = 1 - Math.pow(target > 0.5 ? 0.05 : 0.009, delta)
        converseVignette += (target - converseVignette) * ease
        if (Math.abs(converseVignette - target) < 0.001) converseVignette = target
      }

      // Soft vignette for combat zoom, hex battle stage, and chat framing.
      const focusMix =
        Math.max(combatLive.intensity, converseVignette) * ($reducedMotion ? 0.55 : 1)
      vignette.darkness =
        EXPLORE_VIGNETTE_DARKNESS +
        (COMBAT_VIGNETTE_DARKNESS - EXPLORE_VIGNETTE_DARKNESS) * focusMix
      vignette.offset =
        EXPLORE_VIGNETTE_OFFSET + (COMBAT_VIGNETTE_OFFSET - EXPLORE_VIGNETTE_OFFSET) * focusMix
      if (tiltShift) {
        tiltShift.focusArea =
          EXPLORE_TILT_FOCUS + (COMBAT_TILT_FOCUS - EXPLORE_TILT_FOCUS) * focusMix
        tiltShift.feather =
          EXPLORE_TILT_FEATHER + (COMBAT_TILT_FEATHER - EXPLORE_TILT_FEATHER) * focusMix
        tiltShift.offset = EXPLORE_TILT_OFFSET
      }

      renderer.info.reset()
      composer.render()
      samplePerf(delta, renderer.info)
    },
  )

  $effect(() => {
    bloom.intensity = isMobile || $reducedMotion ? 0.34 : 0.52
  })

  onDestroy(() => {
    task.stop()
    renderStage.removeTask(task)
    composer.dispose()
    renderer.info.autoReset = previousInfoAutoReset
    renderer.info.reset()
    autoRender.set(previousAutoRender)
  })
</script>
