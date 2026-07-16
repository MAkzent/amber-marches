<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Points,
    ShaderMaterial,
  } from 'three'
  import { WHISPERING_ASCENT } from '../data/mysteriousStairs'
  import { reducedMotion } from '../worldState'

  const COUNT = 420
  const positions = new Float32Array(COUNT * 3)
  const seeds = new Float32Array(COUNT)
  let randomState = 0xa51c71
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0
    return randomState / 0xffffffff
  }

  for (let i = 0; i < COUNT; i += 1) {
    const alongCliff = random()
    positions[i * 3] = -8.5 + random() * 10.5
    positions[i * 3 + 1] = 0.4 + random() * 5.5
    positions[i * 3 + 2] = -18 - alongCliff * 12
    seeds[i] = random()
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('seed', new BufferAttribute(seeds, 1))

  const uniforms = {
    uTime: { value: 0 },
    uMotion: { value: 1 },
  }

  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uMotion;
      attribute float seed;
      varying float vFade;
      varying float vSeed;

      void main() {
        vSeed = seed;
        vec3 p = position;
        float t = uTime * uMotion;
        p.x += sin(t * 0.11 + seed * 29.0) * 1.4;
        p.z += cos(t * 0.09 + seed * 17.0) * 1.1;
        p.y += sin(t * 0.18 + seed * 41.0) * 0.45;
        vFade = 0.35 + 0.4 * sin(t * 0.55 + seed * 63.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(18.0 * 90.0 / -mv.z, 4.0, 28.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying float vFade;
      varying float vSeed;

      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float glow = smoothstep(0.5, 0.0, length(d));
        float alpha = glow * 0.085 * vFade;
        vec3 color = mix(vec3(0.72, 0.68, 0.82), vec3(0.9, 0.78, 0.86), fract(vSeed * 3.0));
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })

  const points = new Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 8
  points.position.set(0, WHISPERING_ASCENT.baseY, 0)

  useTask((delta) => {
    uniforms.uTime.value += delta
    uniforms.uMotion.value = $reducedMotion ? 0.15 : 1
  })
</script>

<T is={points} />
