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
    TiltShiftEffect,
    VignetteEffect,
  } from 'postprocessing'
  import { reducedMotion } from '../worldState'
  import { calculatePixelGrid } from './pixelGrid'

  const CSS_PIXEL_SIZE = 2

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
  const normalPass = new NormalPass(scene, camera.current)
  const ambientOcclusion = new SSAOEffect(camera.current, normalPass.texture, {
    blendFunction: BlendFunction.MULTIPLY,
    samples: 8,
    rings: 3,
    radius: 0.065,
    intensity: 1.08,
    luminanceInfluence: 0.84,
  })
  const bloom = new BloomEffect({
    intensity: 0.52,
    luminanceThreshold: 0.56,
    luminanceSmoothing: 0.38,
    mipmapBlur: true,
  })
  const tiltShift = new TiltShiftEffect({
    offset: 0.045,
    focusArea: 0.58,
    feather: 0.28,
    kernelSize: KernelSize.VERY_SMALL,
    resolutionScale: 0.55,
  })
  const hd2dGrade = new SunmereHd2dEffect()
  const vignette = new VignetteEffect({
    darkness: 0.26,
    offset: 0.32,
  })
  const effectPass = new EffectPass(
    camera.current,
    ambientOcclusion,
    bloom,
    tiltShift,
    hd2dGrade,
    vignette,
  )
  composer.addPass(renderPass)
  composer.addPass(normalPass)
  composer.addPass(effectPass)

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
  autoRender.set(false)
  const task = renderStage.createTask(Symbol('storybook-postprocessing'), () => {
    // Threlte owns canvas layout and resizes its renderer before this stage.
    // Compare physical buffer dimensions so CSS size, DPR, orientation and
    // fullscreen changes all update every post-processing render target.
    syncComposerSize()
    renderPass.mainCamera = camera.current
    normalPass.mainCamera = camera.current
    effectPass.mainCamera = camera.current
    composer.render()
  })

  $effect(() => {
    bloom.intensity = $reducedMotion ? 0.34 : 0.52
  })

  onDestroy(() => {
    task.stop()
    renderStage.removeTask(task)
    composer.dispose()
    autoRender.set(previousAutoRender)
  })
</script>
