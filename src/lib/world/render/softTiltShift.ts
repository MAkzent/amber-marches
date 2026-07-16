import { Uniform } from 'three'
import { KernelSize, TiltShiftEffect } from 'postprocessing'

/**
 * postprocessing's TiltShiftEffect composites sharp↔blur with a hard `step()` mask,
 * which reads as a visible horizontal seam. Keep the library's Vector2 maskParams
 * (and its updateParams), and only soften the composite edge with smoothstep.
 */
const SOFT_TILT_SHIFT_FRAGMENT = `#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D map;
#else
uniform lowp sampler2D map;
#endif
uniform vec2 maskParams;
uniform float edgeSoftness;
varying vec2 vUv2;

float linearGradientMask(const in float x) {
  float f = max(edgeSoftness, 1e-4);
  return smoothstep(maskParams.x - f, maskParams.x + f, x)
    - smoothstep(maskParams.y - f, maskParams.y + f, x);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float mask = linearGradientMask(vUv2.y);
  vec4 texel = texture2D(map, uv);
  outputColor = mix(texel, inputColor, mask);
}`

export type SoftTiltShiftOptions = {
  offset?: number
  focusArea?: number
  feather?: number
  kernelSize?: (typeof KernelSize)[keyof typeof KernelSize]
  resolutionScale?: number
}

export function createSoftTiltShiftEffect(
  options: SoftTiltShiftOptions = {},
): TiltShiftEffect {
  const effect = new TiltShiftEffect(options)
  const edgeSoftness = new Uniform(Math.max(options.feather ?? 0.3, 0) * 0.55)

  // Assign before EffectPass compiles — setFragmentShader is protected on Effect.
  ;(effect as TiltShiftEffect & { fragmentShader: string }).fragmentShader =
    SOFT_TILT_SHIFT_FRAGMENT
  effect.uniforms.set('edgeSoftness', edgeSoftness)

  const syncEdgeSoftness = () => {
    // Use a fraction of feather so the soft band eases past the hard step edge
    // without collapsing the sharp midfield.
    edgeSoftness.value = Math.max(effect.feather, 0) * 0.55
  }

  const focusDesc = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(effect),
    'focusArea',
  )
  const featherDesc = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(effect),
    'feather',
  )
  const offsetDesc = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(effect),
    'offset',
  )

  if (featherDesc?.set && featherDesc.get) {
    Object.defineProperty(effect, 'feather', {
      configurable: true,
      get: () => featherDesc.get!.call(effect),
      set: (value: number) => {
        featherDesc.set!.call(effect, value)
        syncEdgeSoftness()
      },
    })
  }
  if (focusDesc?.set && focusDesc.get) {
    Object.defineProperty(effect, 'focusArea', {
      configurable: true,
      get: () => focusDesc.get!.call(effect),
      set: (value: number) => {
        focusDesc.set!.call(effect, value)
        syncEdgeSoftness()
      },
    })
  }
  if (offsetDesc?.set && offsetDesc.get) {
    Object.defineProperty(effect, 'offset', {
      configurable: true,
      get: () => offsetDesc.get!.call(effect),
      set: (value: number) => {
        offsetDesc.set!.call(effect, value)
        syncEdgeSoftness()
      },
    })
  }

  syncEdgeSoftness()
  return effect
}
