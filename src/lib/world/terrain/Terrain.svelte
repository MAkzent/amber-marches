<script lang="ts">
  import { T } from '@threlte/core'
  import {
    AdditiveBlending,
    CircleGeometry,
    DoubleSide,
    MeshBasicMaterial,
    SphereGeometry,
  } from 'three'
  import { completedDiscoveries, dusk } from '../worldState'
  import {
    landmarks,
    landmarkWorldPosition,
    roadPaths,
    terrainHeight,
    WHISPERING_ASCENT,
    walkHeight,
  } from '../data/sunmereVale'
  import { createRoadGeometry, createTerrainGeometry } from './geometry'
  import WorldModel from '../environment/WorldModel.svelte'
  import AscentStructure from '../environment/AscentStructure.svelte'
  import StairMist from '../atmosphere/StairMist.svelte'
  import { gbaToonGradient } from '../render/retroPalette'

  const terrainGeometry = createTerrainGeometry()
  const roads = roadPaths.map((path, index) => ({
    id: `road-${index}`,
    geometry: createRoadGeometry(path, index === 0 ? 1.5 : 1.08),
  }))

  const glowGeometry = new SphereGeometry(0.34, 12, 8)
  const glowMaterial = new MeshBasicMaterial({
    color: '#ffd780',
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
  })
  const ringGeometry = new CircleGeometry(1.7, 48)
  const landingRing = new CircleGeometry(2.05, 40)
  const landingY = walkHeight(WHISPERING_ASCENT.landingX, WHISPERING_ASCENT.landingZ) + 0.06
</script>

<T.Mesh geometry={terrainGeometry} receiveShadow>
  <T.MeshToonMaterial vertexColors gradientMap={gbaToonGradient} />
</T.Mesh>

{#each roads as road (road.id)}
  <T.Mesh geometry={road.geometry} receiveShadow renderOrder={2}>
    <T.MeshToonMaterial
      color="#8d7953"
      gradientMap={gbaToonGradient}
      polygonOffset
      polygonOffsetFactor={-3}
      polygonOffsetUnits={-3}
      side={DoubleSide}
    />
  </T.Mesh>
{/each}

<!-- Open procedural stone treads, risers, and low side curbs. -->
<AscentStructure />

<T.Mesh
  geometry={landingRing}
  position={[WHISPERING_ASCENT.landingX, landingY, WHISPERING_ASCENT.landingZ]}
  rotation={[-Math.PI / 2, 0, 0]}
  renderOrder={2}
>
  <T.MeshBasicMaterial color="#6f8a5c" transparent opacity={0.42} />
</T.Mesh>

<T.Mesh geometry={ringGeometry} position={[-20, terrainHeight(-20, -16) + 0.09, -16]} rotation={[-Math.PI / 2, 0, 0]}>
  <T.MeshBasicMaterial color="#c9a85c" transparent opacity={$completedDiscoveries.has('shrine') ? 0.55 : 0.12} />
</T.Mesh>

{#each landmarks as landmark (landmark.id)}
  <WorldModel
    url={landmark.model}
    position={landmarkWorldPosition(landmark)}
    rotation={landmark.rotation}
    scale={landmark.scale}
    muted={landmark.id === 'far-castle'}
  />
{/each}

<!-- Soft violet wash along the mistcliff stair flight. -->
<T.PointLight
  position={[WHISPERING_ASCENT.landingX + 1.2, WHISPERING_ASCENT.landingY + 2.8, WHISPERING_ASCENT.landingZ]}
  color="#9a8ab8"
  intensity={9}
  distance={16}
/>
<T.PointLight
  position={[WHISPERING_ASCENT.topX + 2.5, WHISPERING_ASCENT.topY + 3.2, WHISPERING_ASCENT.topZ + 1]}
  color="#7a6e9a"
  intensity={11}
  distance={18}
/>

<StairMist />

{#if $completedDiscoveries.has('shrine')}
  <T.Mesh
    geometry={glowGeometry}
    material={glowMaterial}
    position={[-20, terrainHeight(-20, -16) + 4.8, -16]}
    scale={[1, 1.5, 1]}
  />
  <T.PointLight position={[-20, terrainHeight(-20, -16) + 3.2, -16]} color="#ffc66c" intensity={24} distance={15} />
{/if}

{#if $completedDiscoveries.has('watchtower')}
  <T.Mesh
    geometry={glowGeometry}
    material={glowMaterial}
    position={[22, terrainHeight(22, -22) + 10.4, -22]}
    scale={[1.2, 2.4, 1.2]}
  />
  <T.PointLight position={[22, terrainHeight(22, -22) + 9.5, -22]} color="#ffb762" intensity={30} distance={22} />
{/if}

{#if $completedDiscoveries.has('ascent')}
  <T.Mesh
    geometry={glowGeometry}
    material={glowMaterial}
    position={[WHISPERING_ASCENT.topX, WHISPERING_ASCENT.topY + 5.2, WHISPERING_ASCENT.topZ]}
    scale={[1.1, 1.8, 1.1]}
  />
  <T.PointLight
    position={[WHISPERING_ASCENT.topX, WHISPERING_ASCENT.topY + 4.4, WHISPERING_ASCENT.topZ]}
    color="#c4b0e0"
    intensity={22}
    distance={16}
  />
{/if}

{#if $dusk}
  <T.PointLight position={[-7, terrainHeight(-7, 9) + 4, 9]} color="#ffb46a" intensity={18} distance={14} />
  <T.PointLight position={[-15, terrainHeight(-15, 12) + 3.4, 12]} color="#ffb46a" intensity={12} distance={11} />
{/if}
