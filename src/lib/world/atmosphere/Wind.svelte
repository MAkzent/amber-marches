<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    LineBasicMaterial,
    LineSegments,
    Points,
    ShaderMaterial,
    Vector3,
  } from 'three'
  import { playerLive, reducedMotion, weatherMode } from '../worldState'
  import { WIND, advanceWind, getWindTime, windEnvelope } from './wind'

  const LEAF_COUNT = 420
  const STREAK_COUNT = 28
  const BOX = 54
  const HEIGHT = 16

  let randomState = 0x51a7c0de
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0
    return randomState / 0xffffffff
  }

  const leafPositions = new Float32Array(LEAF_COUNT * 3)
  const leafSeeds = new Float32Array(LEAF_COUNT)
  for (let i = 0; i < LEAF_COUNT; i += 1) {
    leafPositions[i * 3] = random() * BOX
    leafPositions[i * 3 + 1] = random() * HEIGHT
    leafPositions[i * 3 + 2] = random() * BOX
    leafSeeds[i] = random()
  }

  const leafGeometry = new BufferGeometry()
  leafGeometry.setAttribute('position', new BufferAttribute(leafPositions, 3))
  leafGeometry.setAttribute('seed', new BufferAttribute(leafSeeds, 1))

  const leafUniforms = {
    uTime: { value: 0 },
    uPush: { value: 0.5 },
    uGust: { value: 0 },
    uWind: { value: new Vector3(WIND.dirX, 0, WIND.dirZ) },
    uBox: { value: BOX },
    uHeight: { value: HEIGHT },
  }

  const leafMaterial = new ShaderMaterial({
    uniforms: leafUniforms,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uPush;
      uniform float uGust;
      uniform vec3 uWind;
      uniform float uBox;
      uniform float uHeight;
      attribute float seed;
      varying float vAlpha;
      varying float vTint;

      void main() {
        // uTime is the shared wind clock — same envelope trees lean with.
        float t = uTime;
        vec3 p = position;
        float speed = 2.8 + seed * 2.2 + uPush * 3.4 + uGust * 4.5;
        // Primary travel strictly along wind; tiny along-wind bob only.
        p += uWind * (t * speed);
        p += uWind * sin(t * 0.55 + seed * 12.0) * (0.2 + uGust * 0.35);
        p.x = mod(p.x, uBox);
        p.z = mod(p.z, uBox);
        p.y = mod(p.y + sin(t * 0.4 + seed * 20.0) * 0.18, uHeight);

        vTint = fract(seed * 7.13);
        vAlpha = 0.32 + 0.28 * uPush + uGust * 0.22;
        vAlpha *= smoothstep(0.0, 1.2, p.y) * (1.0 - smoothstep(uHeight - 2.0, uHeight, p.y));

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((2.8 + uGust * 1.4) * 70.0 / -mv.z, 1.2, 5.8);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying float vAlpha;
      varying float vTint;

      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float leaf = smoothstep(0.48, 0.08, abs(d.x) * 1.35 + abs(d.y));
        float vein = smoothstep(0.12, 0.0, abs(d.x + d.y * 0.15));
        float alpha = leaf * (0.55 + vein * 0.35) * vAlpha;
        if (alpha < 0.02) discard;
        vec3 warm = vec3(0.82, 0.62, 0.28);
        vec3 green = vec3(0.42, 0.62, 0.32);
        vec3 color = mix(green, warm, vTint);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })

  const leaves = new Points(leafGeometry, leafMaterial)
  leaves.frustumCulled = false
  leaves.renderOrder = 8

  const streakPositions = new Float32Array(STREAK_COUNT * 6)
  const streakSeeds: number[] = []
  for (let i = 0; i < STREAK_COUNT; i += 1) {
    streakSeeds.push(random())
    const o = i * 6
    streakPositions[o] = 0
    streakPositions[o + 1] = 0
    streakPositions[o + 2] = 0
    streakPositions[o + 3] = WIND.dirX * 2.4
    streakPositions[o + 4] = 0.15
    streakPositions[o + 5] = WIND.dirZ * 2.4
  }
  const streakGeometry = new BufferGeometry()
  streakGeometry.setAttribute('position', new BufferAttribute(streakPositions, 3))
  const streakMaterial = new LineBasicMaterial({
    color: new Color('#d8c9a4'),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const streaks = new LineSegments(streakGeometry, streakMaterial)
  streaks.frustumCulled = false
  streaks.renderOrder = 9

  const streakOrigins = Array.from({ length: STREAK_COUNT }, () => ({
    x: (random() - 0.5) * BOX,
    y: 1.2 + random() * 7,
    z: (random() - 0.5) * BOX,
  }))

  useTask((delta) => {
    const motion = $reducedMotion ? 0.12 : 1
    advanceWind(delta, motion)

    // Keep the shared wind clock alive, but hide autumn debris in snowfall.
    if ($weatherMode === 'snow') {
      leaves.visible = false
      streakMaterial.opacity = 0
      return
    }
    leaves.visible = true

    const t = getWindTime()
    const { gust, push } = windEnvelope(t)
    leafUniforms.uTime.value = t
    leafUniforms.uPush.value = push
    leafUniforms.uGust.value = gust

    leaves.position.set(playerLive.x - BOX / 2, 0.4, playerLive.z - BOX / 2)
    geometryDrawForMotion(motion)

    const pos = streakGeometry.getAttribute('position') as BufferAttribute
    const arr = pos.array as Float32Array
    // Streak length and speed scale with the same push the trees lean on.
    const len = 1.4 + push * 2.6
    const speed = (4.5 + push * 5.5 + gust * 8) * motion
    for (let i = 0; i < STREAK_COUNT; i += 1) {
      const seed = streakSeeds[i]
      const origin = streakOrigins[i]
      origin.x += WIND.dirX * delta * speed
      origin.z += WIND.dirZ * delta * speed
      origin.y += Math.sin(t * 0.5 + seed * 12) * delta * 0.15 * motion
      if (origin.x > BOX / 2) origin.x -= BOX
      if (origin.x < -BOX / 2) origin.x += BOX
      if (origin.z > BOX / 2) origin.z -= BOX
      if (origin.z < -BOX / 2) origin.z += BOX

      const o = i * 6
      const wx = playerLive.x + origin.x
      const wy = origin.y
      const wz = playerLive.z + origin.z
      arr[o] = wx
      arr[o + 1] = wy
      arr[o + 2] = wz
      arr[o + 3] = wx + WIND.dirX * len
      arr[o + 4] = wy + 0.08 + gust * 0.12
      arr[o + 5] = wz + WIND.dirZ * len
    }
    pos.needsUpdate = true
    streakMaterial.opacity = $reducedMotion ? 0.04 : 0.06 + gust * 0.38 + (push - 0.5) * 0.1
  })

  function geometryDrawForMotion(motion: number) {
    const count = motion < 0.5 ? Math.round(LEAF_COUNT * 0.28) : LEAF_COUNT
    leafGeometry.setDrawRange(0, count)
  }

  geometryDrawForMotion(1)
</script>

<T is={leaves} />
<T is={streaks} />
