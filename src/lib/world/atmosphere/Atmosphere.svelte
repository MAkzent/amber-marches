<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    BufferGeometry,
    Float32BufferAttribute,
    LineBasicMaterial,
    LineSegments,
  } from 'three'
  import { reducedMotion } from '../worldState'
  import RetroSky from './RetroSky.svelte'
  import Weather from './Weather.svelte'
  import Wind from './Wind.svelte'
  import { WIND, getWindTime, windEnvelope } from './wind'

  const birdGeometry = new BufferGeometry()
  birdGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        -0.5, 0, 0, 0, 0.16, 0, 0, 0.16, 0, 0.5, 0, 0,
        2.2, 0.6, -0.7, 2.6, 0.75, -0.7, 2.6, 0.75, -0.7, 3, 0.58, -0.7,
        -2.8, -0.4, 1.2, -2.45, -0.25, 1.2, -2.45, -0.25, 1.2, -2.1, -0.42, 1.2,
      ],
      3,
    ),
  )
  const birds = new LineSegments(
    birdGeometry,
    new LineBasicMaterial({ color: '#38443e', transparent: true, opacity: 0.68 }),
  )
  birds.position.set(-4, 14, -24)
  birds.scale.setScalar(1.1)

  useTask((delta) => {
    if ($reducedMotion) return
    const t = getWindTime()
    const { push, gust } = windEnvelope(t)
    const speed = 0.45 + push * 0.85 + gust * 0.9
    birds.position.x += WIND.dirX * delta * speed
    birds.position.z += WIND.dirZ * delta * speed
    birds.position.y += Math.sin(t * 0.55) * delta * 0.06
    if (birds.position.x > 28) {
      birds.position.x = -24
      birds.position.z = -18
    }
  })
</script>

<RetroSky />
<T is={birds} />
<Wind />
<Weather />
