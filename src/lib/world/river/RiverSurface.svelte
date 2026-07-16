<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    RIVER_LENGTH_SEGMENTS,
    RIVER_RENDER_ORDER,
    RIVER_WIDTH_SEGMENTS,
  } from './riverConfig'
  import { createRiverSurfaceGeometry } from './riverGeometry'
  import { createRiverWaterMaterial } from './riverWaterMaterial'
  import { getWaterDisturbances } from './riverDisturbance'
  import { reducedMotion } from '../worldState'

  const surfaceGeometry = createRiverSurfaceGeometry(
    RIVER_LENGTH_SEGMENTS,
    RIVER_WIDTH_SEGMENTS,
  )
  const waterMaterial = createRiverWaterMaterial()

  useTask((delta) => {
    if (!$reducedMotion) {
      waterMaterial.uniforms.uTime.value += delta
    }
    waterMaterial.userData.syncDisturbances(getWaterDisturbances(), $reducedMotion)
  })
</script>

<T.Mesh
  geometry={surfaceGeometry}
  material={waterMaterial}
  renderOrder={RIVER_RENDER_ORDER.surface}
  receiveShadow
/>
