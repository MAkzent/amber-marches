<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    NormalBlending,
    Points,
    ShaderMaterial,
    Vector2,
  } from 'three'
  import { playerLive, reducedMotion, weatherMode } from '../worldState'

  const MAX = 3200
  const BOX = 62
  const HEIGHT = 34
  const positions = new Float32Array(MAX * 3)
  const seeds = new Float32Array(MAX)
  let randomState = 0x7182ac3
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0
    return randomState / 0xffffffff
  }

  for (let index = 0; index < MAX; index += 1) {
    positions[index * 3] = random() * BOX
    positions[index * 3 + 1] = random() * HEIGHT
    positions[index * 3 + 2] = random() * BOX
    seeds[index] = random()
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('seed', new BufferAttribute(seeds, 1))

  const uniforms = {
    uTime: { value: 0 },
    uHeight: { value: HEIGHT },
    uMode: { value: 0 },
    uWind: { value: new Vector2(0.24, 0.07) },
    uMotion: { value: 1 },
  }

  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: NormalBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uHeight;
      uniform float uMode;
      uniform float uMotion;
      uniform vec2 uWind;
      attribute float seed;
      varying float vSeed;
      varying float vMode;
      varying float vFade;

      void main() {
        vSeed = seed;
        vMode = uMode;
        vec3 p = position;
        float t = uTime * uMotion;

        if (uMode < 0.5) {
          float speed = 13.0 + seed * 10.0;
          p.y = mod(p.y - t * speed, uHeight);
          float fallen = uHeight - p.y;
          p.x += uWind.x * fallen + sin(seed * 37.0 + t * 0.25) * 0.28;
          p.z += uWind.y * fallen;
          vFade = smoothstep(0.0, 3.0, p.y) * (1.0 - smoothstep(uHeight - 5.0, uHeight, p.y));
        } else if (uMode < 1.5) {
          p.x += sin(t * 0.42 + seed * 41.0) * 2.4;
          p.z += cos(t * 0.36 + seed * 29.0) * 2.1;
          p.y = 0.8 + mod(p.y, 8.0) + sin(t * 0.9 + seed * 53.0) * 0.65;
          vFade = 0.55 + 0.45 * sin(t * 2.2 + seed * 97.0);
        } else {
          p.x += sin(t * 0.16 + seed * 31.0) * 3.0;
          p.z += cos(t * 0.13 + seed * 17.0) * 2.0;
          p.y = 1.0 + mod(p.y, 12.0) + sin(t * 0.35 + seed * 47.0) * 0.6;
          vFade = 0.45 + 0.3 * sin(t + seed * 71.0);
        }

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float size = uMode < 0.5 ? 6.4 : (uMode < 1.5 ? 4.8 : 2.6);
        gl_PointSize = clamp(size * 90.0 / -mv.z, uMode < 0.5 ? 2.2 : 1.4, uMode < 0.5 ? 12.0 : 7.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying float vSeed;
      varying float vMode;
      varying float vFade;

      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float alpha;
        vec3 color;

        if (vMode < 0.5) {
          d.x += d.y * 0.22;
          float streak = smoothstep(0.13, 0.02, abs(d.x));
          float ends = 1.0 - smoothstep(0.24, 0.5, abs(d.y));
          alpha = streak * ends * 0.58 * vFade;
          color = mix(vec3(0.72, 0.88, 0.88), vec3(1.0, 0.88, 0.62), vSeed * 0.18);
        } else if (vMode < 1.5) {
          float glow = smoothstep(0.5, 0.0, length(d));
          alpha = glow * (0.45 + 0.55 * vFade);
          color = mix(vec3(1.0, 0.62, 0.18), vec3(0.74, 1.0, 0.36), fract(vSeed * 5.0));
        } else {
          float diamond = smoothstep(0.5, 0.05, abs(d.x) + abs(d.y));
          alpha = diamond * 0.35 * vFade;
          color = mix(vec3(0.90, 0.74, 0.32), vec3(0.52, 0.72, 0.34), vSeed);
        }

        if (alpha < 0.02) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })

  const weather = new Points(geometry, material)
  weather.frustumCulled = false
  weather.renderOrder = 7

  $effect(() => {
    const mode = $weatherMode
    uniforms.uMode.value = mode === 'fireflies' ? 1 : mode === 'clear' ? 2 : 0
    uniforms.uMotion.value = $reducedMotion ? 0.18 : 1
    const fullCount = mode === 'sunshower' ? 1950 : mode === 'fireflies' ? 520 : 280
    geometry.setDrawRange(0, $reducedMotion ? Math.round(fullCount * 0.35) : fullCount)
    material.blending = mode === 'fireflies' ? AdditiveBlending : NormalBlending
    material.needsUpdate = true
  })

  useTask((delta) => {
    uniforms.uTime.value += delta
    if ($weatherMode !== 'fireflies') {
      weather.position.set(playerLive.x - BOX / 2, -1.5, playerLive.z - BOX / 2)
    }
  })
</script>

<T is={weather} />
