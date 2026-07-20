<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import { onDestroy } from 'svelte'
  import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    Points,
    PointsMaterial,
  } from 'three'
  import { reducedMotion } from '../worldState'
  import { damageEvents } from './runtime'

  const MAX_PARTICLES = 72
  const positions = new Float32Array(MAX_PARTICLES * 3)
  const colors = new Float32Array(MAX_PARTICLES * 3)
  const velocities = new Float32Array(MAX_PARTICLES * 3)
  const lives = new Float32Array(MAX_PARTICLES)
  const seen = new Set<number>()
  const gold = new Color('#ffd06a')
  const ember = new Color('#ff5c35')
  let cursor = 0

  for (let index = 0; index < MAX_PARTICLES; index += 1) {
    positions[index * 3 + 1] = -100
  }

  const geometry = new BufferGeometry()
  const positionAttribute = new BufferAttribute(positions, 3)
  const colorAttribute = new BufferAttribute(colors, 3)
  geometry.setAttribute('position', positionAttribute)
  geometry.setAttribute('color', colorAttribute)

  const material = new PointsMaterial({
    size: 0.3,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    sizeAttenuation: true,
    blending: AdditiveBlending,
    toneMapped: false,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 9

  function emit(x: number, y: number, z: number, defeated: boolean) {
    const count = $reducedMotion ? 4 : defeated ? 18 : 11
    for (let particle = 0; particle < count; particle += 1) {
      const index = cursor++ % MAX_PARTICLES
      const offset = index * 3
      const angle = (particle / count) * Math.PI * 2 + Math.random() * 0.35
      const speed = (defeated ? 2.8 : 2.2) * (0.65 + Math.random() * 0.65)
      positions[offset] = x + (Math.random() - 0.5) * 0.3
      positions[offset + 1] = y - 0.55 + (Math.random() - 0.5) * 0.25
      positions[offset + 2] = z + (Math.random() - 0.5) * 0.3
      velocities[offset] = Math.cos(angle) * speed
      velocities[offset + 1] = 1.2 + Math.random() * 2.1
      velocities[offset + 2] = Math.sin(angle) * speed
      lives[index] = 0.26 + Math.random() * (defeated ? 0.28 : 0.16)
      const color = particle % 3 === 0 ? ember : gold
      colors[offset] = color.r
      colors[offset + 1] = color.g
      colors[offset + 2] = color.b
    }
    positionAttribute.needsUpdate = true
    colorAttribute.needsUpdate = true
  }

  useTask((delta) => {
    for (const event of damageEvents) {
      if (seen.has(event.id)) continue
      seen.add(event.id)
      emit(event.x, event.y, event.z, event.defeated)
    }

    let changed = false
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      if (lives[index] <= 0) continue
      lives[index] -= delta
      const offset = index * 3
      if (lives[index] <= 0) {
        positions[offset + 1] = -100
      } else {
        positions[offset] += velocities[offset] * delta
        positions[offset + 1] += velocities[offset + 1] * delta
        positions[offset + 2] += velocities[offset + 2] * delta
        velocities[offset] *= Math.pow(0.08, delta)
        velocities[offset + 1] -= 9.5 * delta
        velocities[offset + 2] *= Math.pow(0.08, delta)
      }
      changed = true
    }
    if (changed) positionAttribute.needsUpdate = true
  })

  onDestroy(() => {
    geometry.dispose()
    material.dispose()
  })
</script>

<T is={points} />
