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
  import { get } from 'svelte/store'
  import {
    graphicsTier,
    playerLive,
    reducedMotion,
    weatherMode,
    type WeatherMode,
  } from '../worldState'
  import { battleHud } from '../battle'
  import { WIND, getWindTime, windEnvelope } from './wind'

  const MAX = 2800
  const BOX = 72
  const HEIGHT = 36
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
    uBox: { value: BOX },
    uMode: { value: 0 },
    uWind: { value: new Vector2(0.24, 0.07) },
    uGust: { value: 0 },
    uMotion: { value: 1 },
    uClarity: { value: 1 },
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
      uniform float uBox;
      uniform float uMode;
      uniform float uMotion;
      uniform float uGust;
      uniform vec2 uWind;
      attribute float seed;
      varying float vSeed;
      varying float vMode;
      varying float vFade;
      varying float vSize;

      float wrap(float v, float m) {
        return fract(v / m) * m;
      }

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
          vSize = 6.4;
        } else if (uMode < 1.5) {
          p.x += sin(t * 0.42 + seed * 41.0) * 2.4;
          p.z += cos(t * 0.36 + seed * 29.0) * 2.1;
          p.y = 0.8 + mod(p.y, 8.0) + sin(t * 0.9 + seed * 53.0) * 0.65;
          vFade = 0.55 + 0.45 * sin(t * 2.2 + seed * 97.0);
          vSize = 4.8;
        } else if (uMode < 2.5) {
          p.x += sin(t * 0.16 + seed * 31.0) * 3.0;
          p.z += cos(t * 0.13 + seed * 17.0) * 2.0;
          p.y = 1.0 + mod(p.y, 12.0) + sin(t * 0.35 + seed * 47.0) * 0.6;
          vFade = 0.45 + 0.3 * sin(t + seed * 71.0);
          vSize = 2.6;
        } else {
          // Follow-box is already centered on the player; wrap drift in local space
          // so flakes stay dense without sliding with the camera.
          float speed = 2.4 + seed * 3.4;
          float sway = 0.7 + seed * 1.1;
          float flutter = sin(t * (1.05 + seed * 1.6) + seed * 48.0) * sway;
          float cross = cos(t * (0.85 + seed * 1.25) + seed * 33.0) * sway * 0.7;
          float windScale = 0.55 + uGust * 1.15;
          float driftX = uWind.x * t * (1.6 + seed * 1.2) * windScale + flutter;
          float driftZ = uWind.y * t * (1.6 + seed * 1.2) * windScale + cross;
          p.x = wrap(position.x + driftX, uBox);
          p.z = wrap(position.z + driftZ, uBox);
          p.y = wrap(position.y - t * speed, uHeight);
          vFade = smoothstep(0.0, 1.2, p.y) * (1.0 - smoothstep(uHeight - 5.5, uHeight, p.y));
          vFade *= 0.85 + 0.15 * sin(seed * 91.0 + t * 0.35);
          vSize = mix(3.4, 7.2, fract(seed * 7.13));
        }

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float minSize = uMode > 2.5 ? 1.8 : (uMode < 0.5 ? 2.2 : 1.4);
        float maxSize = uMode > 2.5 ? 9.0 : (uMode < 0.5 ? 12.0 : 7.0);
        gl_PointSize = clamp(vSize * 90.0 / -mv.z, minSize, maxSize);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying float vSeed;
      varying float vMode;
      varying float vFade;
      varying float vSize;
      uniform float uClarity;

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
        } else if (vMode < 2.5) {
          float diamond = smoothstep(0.5, 0.05, abs(d.x) + abs(d.y));
          alpha = diamond * 0.35 * vFade;
          color = mix(vec3(0.90, 0.74, 0.32), vec3(0.52, 0.72, 0.34), vSeed);
        } else {
          float r = length(d);
          float soft = smoothstep(0.5, 0.06, r);
          float ax = abs(d.x);
          float ay = abs(d.y);
          float hex = abs(ax * 0.866 + ay * 0.5) + ay * 0.5;
          float crystal = smoothstep(0.44, 0.1, hex) * smoothstep(0.55, 0.18, r);
          float flakeMix = mix(0.2, 0.55, smoothstep(4.0, 6.5, vSize));
          alpha = mix(soft, max(soft, crystal), flakeMix) * (0.55 + 0.28 * vFade);
          vec3 bright = vec3(0.92, 0.95, 0.98);
          vec3 cool = vec3(0.72, 0.82, 0.94);
          vec3 softBlue = vec3(0.84, 0.90, 0.97);
          color = mix(bright, mix(softBlue, cool, fract(vSeed * 3.7)), 0.3 + vSeed * 0.35);
        }

        alpha *= uClarity;
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })

  const weather = new Points(geometry, material)
  weather.frustumCulled = false
  weather.renderOrder = 7

  function modeValue(mode: WeatherMode) {
    if (mode === 'fireflies') return 1
    if (mode === 'clear') return 2
    if (mode === 'snow') return 3
    return 0
  }

  function particleCount(mode: WeatherMode) {
    const scale = get(graphicsTier) === 'mobile' ? 0.45 : 1
    if (mode === 'sunshower') return Math.round(1950 * scale)
    // Dense enough to read as snowfall; capped so bloom/SSAO fill-rate stays stable.
    if (mode === 'snow') return Math.round(2100 * scale)
    if (mode === 'fireflies') return Math.round(520 * scale)
    return Math.round(280 * scale)
  }

  $effect(() => {
    const mode = $weatherMode
    uniforms.uMode.value = modeValue(mode)
    uniforms.uMotion.value = $reducedMotion ? 0.18 : 1
    const fullCount = particleCount(mode)
    geometry.setDrawRange(0, $reducedMotion ? Math.round(fullCount * 0.35) : fullCount)
    material.blending = mode === 'fireflies' ? AdditiveBlending : NormalBlending
    material.needsUpdate = true
  })

  useTask((delta) => {
    uniforms.uTime.value += delta
    uniforms.uClarity.value = 1 - $battleHud.stageBlend * 0.6
    const mode = $weatherMode
    if (mode === 'snow') {
      const { gust, push } = windEnvelope(getWindTime())
      const windScale = 0.22 + push * 0.28
      uniforms.uWind.value.set(WIND.dirX * windScale, WIND.dirZ * windScale)
      uniforms.uGust.value = gust
      weather.position.set(playerLive.x - BOX / 2, -1.5, playerLive.z - BOX / 2)
    } else if (mode !== 'fireflies') {
      uniforms.uWind.value.set(0.24, 0.07)
      uniforms.uGust.value = 0
      weather.position.set(playerLive.x - BOX / 2, -1.5, playerLive.z - BOX / 2)
    }
  })
</script>

<T is={weather} />
