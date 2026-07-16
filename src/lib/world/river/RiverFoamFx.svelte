<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    Mesh,
    NormalBlending,
    Points,
    RingGeometry,
    ShaderMaterial,
  } from 'three'
  import { WATER_SURFACE_Y } from '../data/silverrunChannel'
  import { reducedMotion } from '../worldState'
  import { RIVER_PALETTE, RIVER_RENDER_ORDER } from './riverConfig'
  import {
    MAX_WATER_DISTURBANCES,
    getWaterDisturbances,
    tickWaterDisturbances,
    type WaterDisturbance,
  } from './riverDisturbance'
  import { RIVER_ADDITIVE_OUTPUT_CHUNK } from './riverShaderChunks'

  const ringGeometry = new RingGeometry(0.18, 0.42, 24, 1)
  const ringMaterialBase = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: DoubleSide,
    blending: NormalBlending,
    uniforms: {
      uOpacity: { value: 0 },
      uFoam: { value: new Color(RIVER_PALETTE.foam) },
      uCore: { value: new Color('#f0fcff') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform vec3 uFoam;
      uniform vec3 uCore;

      void main() {
        float radial = vUv.y;
        float band = smoothstep(0.05, 0.35, radial) * (1.0 - smoothstep(0.55, 0.98, radial));
        float crest = smoothstep(0.22, 0.0, abs(radial - 0.42));
        float alpha = (band * 0.45 + crest * 0.55) * uOpacity;
        if (alpha < 0.015) discard;
        vec3 col = mix(uFoam, uCore, crest * 0.65);
        gl_FragColor = vec4(col, alpha);
        ${RIVER_ADDITIVE_OUTPUT_CHUNK}
      }
    `,
  })

  const rings: Mesh[] = Array.from({ length: MAX_WATER_DISTURBANCES }, () => {
    const ring = new Mesh(ringGeometry, ringMaterialBase.clone())
    ring.visible = false
    ring.rotation.x = -Math.PI / 2
    ring.renderOrder = RIVER_RENDER_ORDER.wakeRings
    return ring
  })
  const ringOrigins = new WeakMap<WaterDisturbance, { x: number; z: number }>()

  /**
   * Classic Three.js Points splash pool — additive droplets with gravity.
   * Spawned once per footfall; positions stay world-fixed (no follow).
   */
  const MAX_SPLASHES = 96
  const splashPositions = new Float32Array(MAX_SPLASHES * 3)
  const splashAges = new Float32Array(MAX_SPLASHES)
  const splashLives = new Float32Array(MAX_SPLASHES)
  const splashSeeds = new Float32Array(MAX_SPLASHES)
  const splashVx = new Float32Array(MAX_SPLASHES)
  const splashVy = new Float32Array(MAX_SPLASHES)
  const splashVz = new Float32Array(MAX_SPLASHES)
  let splashCursor = 0

  for (let index = 0; index < MAX_SPLASHES; index += 1) {
    splashAges[index] = 99
    splashLives[index] = 1
    splashSeeds[index] = (index * 0.61803398875) % 1
  }

  const splashGeometry = new BufferGeometry()
  splashGeometry.setAttribute('position', new BufferAttribute(splashPositions, 3))
  splashGeometry.setAttribute('aAge', new BufferAttribute(splashAges, 1))
  splashGeometry.setAttribute('aLife', new BufferAttribute(splashLives, 1))
  splashGeometry.setAttribute('aSeed', new BufferAttribute(splashSeeds, 1))

  const splashMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color('#dff8ff') },
      uWater: { value: new Color('#3ec8e8') },
    },
    vertexShader: /* glsl */ `
      attribute float aAge;
      attribute float aLife;
      attribute float aSeed;
      varying float vFade;
      varying float vSeed;

      void main() {
        float progress = clamp(aAge / max(aLife, 0.001), 0.0, 1.0);
        vFade = 1.0 - progress;
        vFade *= vFade;
        vSeed = aSeed;
        if (progress >= 1.0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          gl_PointSize = 0.0;
          return;
        }
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float size = mix(5.5, 11.0, aSeed) * (0.75 + vFade * 0.55);
        gl_PointSize = clamp(size * 78.0 / -mv.z, 2.0, 14.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vFade;
      varying float vSeed;
      uniform vec3 uColor;
      uniform vec3 uWater;

      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float r = length(p);
        float droplet = smoothstep(0.5, 0.08, r);
        float highlight = smoothstep(0.28, 0.0, length(p - vec2(-0.12, -0.16)));
        float alpha = droplet * vFade * mix(0.4, 0.7, vSeed);
        if (alpha < 0.02) discard;
        vec3 col = mix(uWater, uColor, 0.25 + vSeed * 0.25);
        col = mix(col, uColor, highlight * 0.2 * vFade);
        gl_FragColor = vec4(col, alpha);
        ${RIVER_ADDITIVE_OUTPUT_CHUNK}
      }
    `,
  })

  const splashes = new Points(splashGeometry, splashMaterial)
  splashes.renderOrder = RIVER_RENDER_ORDER.splash
  splashes.frustumCulled = false
  const spawnedDisturbances = new WeakSet<WaterDisturbance>()

  function emitDrop(
    x: number,
    z: number,
    strength: number,
    depth: number,
    speedScale: number,
    liftScale: number,
  ) {
    const index = splashCursor % MAX_SPLASHES
    splashCursor += 1
    const angle = Math.random() * Math.PI * 2
    const speed = (0.55 + Math.random() * 1.15 * strength) * speedScale
    const lift = (1.6 + Math.random() * 2.1 + depth * 1.1) * liftScale
    splashPositions[index * 3] = x + Math.cos(angle) * (0.04 + Math.random() * 0.1)
    splashPositions[index * 3 + 1] = WATER_SURFACE_Y + 0.03 + Math.random() * 0.06
    splashPositions[index * 3 + 2] = z + Math.sin(angle) * (0.04 + Math.random() * 0.1)
    splashVx[index] = Math.cos(angle) * speed
    splashVy[index] = lift
    splashVz[index] = Math.sin(angle) * speed
    splashAges[index] = 0
    splashLives[index] = 0.38 + Math.random() * 0.42
    splashSeeds[index] = Math.random()
  }

  function spawnSplash(disturbance: WaterDisturbance) {
    if (disturbance.strength < 0.18) return
    const strength = disturbance.strength
    const depth = disturbance.depth
    // Upward crown burst (classic Points spray).
    const crown = 6 + Math.round(Math.min(10, strength * 5 + depth * 2.5))
    for (let drop = 0; drop < crown; drop += 1) {
      emitDrop(disturbance.x, disturbance.z, strength, depth, 1, 1)
    }
    // Wider low mist / skim spray.
    const spray = 4 + Math.round(Math.min(6, strength * 2.4))
    for (let drop = 0; drop < spray; drop += 1) {
      emitDrop(disturbance.x, disturbance.z, strength * 0.85, depth, 1.55, 0.4)
    }
    splashGeometry.attributes.position.needsUpdate = true
    splashGeometry.attributes.aLife.needsUpdate = true
    splashGeometry.attributes.aSeed.needsUpdate = true
  }

  useTask((delta) => {
    tickWaterDisturbances(delta)
    const live = getWaterDisturbances()
    for (const disturbance of live) {
      if (spawnedDisturbances.has(disturbance)) continue
      spawnedDisturbances.add(disturbance)
      if (!$reducedMotion) spawnSplash(disturbance)
    }

    for (let index = 0; index < rings.length; index += 1) {
      const ring = rings[index]
      const disturbance = live[index]
      if (!disturbance || $reducedMotion) {
        ring.visible = false
        continue
      }

      const progress = Math.min(1, disturbance.age / 1.85)
      const expand = 0.32 + progress * (1.15 + disturbance.strength * 0.65 + disturbance.depth * 0.22)
      let origin = ringOrigins.get(disturbance)
      if (!origin) {
        origin = { x: disturbance.x, z: disturbance.z }
        ringOrigins.set(disturbance, origin)
      }
      ring.visible = true
      ring.position.set(origin.x, WATER_SURFACE_Y + 0.02, origin.z)
      ring.scale.setScalar(expand)
      const material = ring.material as ShaderMaterial
      // Soft, low-opacity wakes — splash carries the walk read.
      material.uniforms.uOpacity.value =
        (1 - progress) * (1 - progress) * Math.min(0.28, 0.1 + disturbance.strength * 0.14)
    }

    let particlesMoved = false
    for (let index = 0; index < MAX_SPLASHES; index += 1) {
      if (splashAges[index] >= splashLives[index]) continue
      splashAges[index] += delta
      splashVy[index] -= 9.5 * delta
      splashPositions[index * 3] += splashVx[index] * delta
      splashPositions[index * 3 + 1] += splashVy[index] * delta
      splashPositions[index * 3 + 2] += splashVz[index] * delta
      if (splashPositions[index * 3 + 1] < WATER_SURFACE_Y + 0.01 && splashVy[index] < 0) {
        splashAges[index] = splashLives[index]
      }
      particlesMoved = true
    }
    if (particlesMoved) {
      splashGeometry.attributes.position.needsUpdate = true
      splashGeometry.attributes.aAge.needsUpdate = true
    }
  })
</script>

{#each rings as ring (ring.uuid)}
  <T is={ring} />
{/each}
<T is={splashes} />
