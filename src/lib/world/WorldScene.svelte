<script lang="ts">
  import { T } from '@threlte/core'
  import { DirectionalLight } from 'three'
  import Terrain from './terrain/Terrain.svelte'
  import River from './river/River.svelte'
  import GrassField from './environment/GrassField.svelte'
  import Scenery from './environment/Scenery.svelte'
  import Atmosphere from './atmosphere/Atmosphere.svelte'
  import HeroParty from './actors/HeroParty.svelte'
  import ValeNpc from './actors/ValeNpc.svelte'
  import WorldCamera from './camera/WorldCamera.svelte'
  import DiscoveryMarkers from './environment/DiscoveryMarkers.svelte'
  import WorldRenderer from './render/WorldRenderer.svelte'
  import { get } from 'svelte/store'
  import { dusk, graphicsTier, weatherMode } from './worldState'

  const sun = new DirectionalLight('#ffc978', 3.25)
  sun.position.set(-32, 34, -24)
  sun.castShadow = true
  const shadowMapSize = get(graphicsTier) === 'mobile' ? 512 : 1024
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
  sun.shadow.camera.left = -48
  sun.shadow.camera.right = 48
  sun.shadow.camera.top = 44
  sun.shadow.camera.bottom = -44
  sun.shadow.camera.near = 2
  sun.shadow.camera.far = 110
  sun.shadow.bias = -0.00045
  sun.shadow.normalBias = 0.08

  const fill = new DirectionalLight('#78a6ac', 0.72)
  fill.position.set(26, 18, 30)

  const snowing = $derived($weatherMode === 'snow' && !$dusk)
</script>

<T.Color attach="background" args={[$dusk ? '#69576b' : snowing ? '#8a9eb0' : '#739097']} />

<WorldCamera />
<WorldRenderer />
<Atmosphere />

<T.HemisphereLight
  color={$dusk ? '#aa90a6' : snowing ? '#c5d4e2' : '#cbdac2'}
  groundColor={$dusk ? '#3d3042' : snowing ? '#6a7068' : '#765539'}
  intensity={$dusk ? 1.05 : snowing ? 1.08 : 0.98}
/>
<T.AmbientLight
  color={$dusk ? '#8f6b82' : snowing ? '#dce8f2' : '#ffe2b8'}
  intensity={$dusk ? 0.16 : snowing ? 0.22 : 0.16}
/>
<T
  is={sun}
  intensity={$dusk ? 1.12 : snowing ? 2.05 : 3.25}
  color={$dusk ? '#ff9870' : snowing ? '#e4eef8' : '#ffc978'}
/>
<T
  is={fill}
  intensity={$dusk ? 0.28 : snowing ? 0.85 : 0.72}
  color={$dusk ? '#7779a4' : snowing ? '#9bb4c8' : '#78a6ac'}
/>

<Terrain />
<River />
<GrassField />
<Scenery />
<DiscoveryMarkers />
<ValeNpc />
<HeroParty />
