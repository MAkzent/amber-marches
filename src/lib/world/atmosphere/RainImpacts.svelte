<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    BufferAttribute,
    BufferGeometry,
    Color,
    NormalBlending,
    Points,
    ShaderMaterial,
  } from 'three'
  import { get } from 'svelte/store'
  import { sampleRiver, WATER_SURFACE_Y } from '../data/silverrunChannel'
  import { walkHeight } from '../data/amberMarches'
  import {
    graphicsTier,
    playerLive,
    reducedMotion,
    weatherMode,
  } from '../worldState'
  import { battleHud, ENCOUNTER_ORIGIN } from '../battle'

  /**
   * Intensity is derived from Weather.svelte sunshower volume so ground hits
   * track the airborne streak density (same tier / reduced-motion scales).
   */
  const WEATHER_COUNT = 1950
  const WEATHER_BOX = 72
  const WEATHER_HEIGHT = 36
  /** Midpoint of sunshower fall speed (13 + seed*10). */
  const AVG_FALL_SPEED = 18
  /**
   * Fraction of theoretical ground arrivals that spawn a visible ripple.
   * Below 1 keeps GPU fill-rate sane while still reading as hard rain.
   */
  const SPLASH_FRACTION = 0.84

  const MAX = 360
  /** Tighter than weather follow-box so density reads near the camera. */
  const BOX = 40

  const positions = new Float32Array(MAX * 3)
  const ages = new Float32Array(MAX)
  const lives = new Float32Array(MAX)
  const seeds = new Float32Array(MAX)
  const kinds = new Float32Array(MAX)

  for (let index = 0; index < MAX; index += 1) {
    ages[index] = 99
    lives[index] = 1
    seeds[index] = (index * 0.61803398875) % 1
    kinds[index] = 0
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aAge', new BufferAttribute(ages, 1))
  geometry.setAttribute('aLife', new BufferAttribute(lives, 1))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geometry.setAttribute('aKind', new BufferAttribute(kinds, 1))
  geometry.setDrawRange(0, 0)

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    blending: NormalBlending,
    uniforms: {
      uGround: { value: new Color('#d8e8e6') },
      uWater: { value: new Color('#7ecfe0') },
      uWaterCore: { value: new Color('#e8f8fc') },
    },
    vertexShader: /* glsl */ `
      attribute float aAge;
      attribute float aLife;
      attribute float aSeed;
      attribute float aKind;
      varying float vFade;
      varying float vProgress;
      varying float vSeed;
      varying float vKind;

      void main() {
        float progress = clamp(aAge / max(aLife, 0.001), 0.0, 1.0);
        vProgress = progress;
        vSeed = aSeed;
        vKind = aKind;
        // Quick pop then ease out.
        vFade = (1.0 - progress);
        vFade *= vFade * (1.0 - progress * 0.35);

        if (progress >= 1.0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          gl_PointSize = 0.0;
          return;
        }

        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float base = mix(7.0, 14.0, aKind);
        float grow = mix(0.55, 1.35, progress);
        float size = base * grow * mix(0.85, 1.15, aSeed);
        gl_PointSize = clamp(size * 72.0 / -mv.z, 3.0, 22.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vFade;
      varying float vProgress;
      varying float vSeed;
      varying float vKind;
      uniform vec3 uGround;
      uniform vec3 uWater;
      uniform vec3 uWaterCore;

      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float r = length(p);
        // Expanding ring: inner hole grows with progress.
        float inner = mix(0.08, 0.32, vProgress);
        float outer = mix(0.22, 0.48, vProgress);
        float ring = smoothstep(inner - 0.04, inner, r) * (1.0 - smoothstep(outer - 0.06, outer, r));
        float soft = smoothstep(0.5, 0.2, r) * (1.0 - smoothstep(0.0, 0.18, r)) * 0.15;
        float alpha = (ring * 0.85 + soft) * vFade * mix(0.45, 0.75, vSeed);
        if (alpha < 0.02) discard;

        vec3 ground = uGround;
        vec3 water = mix(uWater, uWaterCore, smoothstep(0.15, 0.35, r) * (1.0 - vProgress));
        vec3 col = mix(ground, water, vKind);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  })

  const impacts = new Points(geometry, material)
  impacts.frustumCulled = false
  impacts.renderOrder = 4

  let spawnAcc = 0
  let cursor = 0
  let randomState = 0x4a1c3e91
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0
    return randomState / 0xffffffff
  }

  /** Same count scaling as Weather.svelte sunshower particles. */
  function weatherParticleCount() {
    const scale = get(graphicsTier) === 'mobile' ? 0.45 : 1
    const full = Math.round(WEATHER_COUNT * scale)
    return get(reducedMotion) ? Math.round(full * 0.35) : full
  }

  /**
   * Ground arrivals ≈ streaks × (fallSpeed / columnHeight), then area-scaled
   * into our tighter follow-box and thinned by SPLASH_FRACTION.
   */
  function spawnRate() {
    const hitsPerSec = weatherParticleCount() * (AVG_FALL_SPEED / WEATHER_HEIGHT)
    const areaScale = (BOX * BOX) / (WEATHER_BOX * WEATHER_BOX)
    const battleScale = $battleHud.phase === 'idle' ? 1 : 0.3
    return hitsPerSec * areaScale * SPLASH_FRACTION * battleScale
  }

  /** Pool sized for ~avg life × rate, with headroom; capped at MAX. */
  function poolCount() {
    const avgLife = 0.36
    const needed = Math.ceil(spawnRate() * avgLife * 1.35)
    return Math.max(24, Math.min(MAX, needed))
  }

  function emitImpact(count: number) {
    const index = cursor % count
    cursor += 1
    const focusBlend = $battleHud.stageBlend
    const focusX = playerLive.x + (ENCOUNTER_ORIGIN.x - playerLive.x) * focusBlend
    const focusZ = playerLive.z + (ENCOUNTER_ORIGIN.z - playerLive.z) * focusBlend
    const x = focusX + (random() - 0.5) * BOX
    const z = focusZ + (random() - 0.5) * BOX
    const river = sampleRiver(x, z)
    const water = river.inWater
    positions[index * 3] = x
    positions[index * 3 + 1] = water ? WATER_SURFACE_Y + 0.02 : walkHeight(x, z) + 0.02
    positions[index * 3 + 2] = z
    ages[index] = 0
    lives[index] = 0.26 + random() * 0.2
    seeds[index] = random()
    kinds[index] = water ? 1 : 0
  }

  $effect(() => {
    const active = $weatherMode === 'sunshower'
    // Touch stores so pool/draw range rebuilds when tier or motion prefs change.
    void $graphicsTier
    void $reducedMotion
    geometry.setDrawRange(0, active ? poolCount() : 0)
  })

  useTask((delta) => {
    if ($weatherMode !== 'sunshower') {
      spawnAcc = 0
      return
    }

    const count = Math.max(1, poolCount())
    const rate = spawnRate()
    spawnAcc += delta * rate
    while (spawnAcc >= 1) {
      spawnAcc -= 1
      emitImpact(count)
    }

    for (let index = 0; index < count; index += 1) {
      if (ages[index] < lives[index]) {
        ages[index] += delta
      }
    }

    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aAge.needsUpdate = true
    geometry.attributes.aLife.needsUpdate = true
    geometry.attributes.aSeed.needsUpdate = true
    geometry.attributes.aKind.needsUpdate = true
  })
</script>

<T is={impacts} />
