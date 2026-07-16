/**
 * Shared GLSL endings for custom river ShaderMaterials.
 *
 * THREE.Color(hex) stores linear working-space values. Built-in materials
 * re-encode via colorspace_fragment; hand-rolled shaders must do the same
 * or midtones crush into muddy olive under ACES + the HD2D grade.
 */
export const RIVER_OUTPUT_CHUNK = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`

/** Additive foam/splash — skip ACES so particles stay bright after grade. */
export const RIVER_ADDITIVE_OUTPUT_CHUNK = /* glsl */ `
  #include <colorspace_fragment>
`
