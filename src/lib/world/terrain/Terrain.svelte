<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    AdditiveBlending,
    CircleGeometry,
    Color,
    DoubleSide,
    MeshBasicMaterial,
    ShaderMaterial,
    SphereGeometry,
  } from 'three'
  import { completedDiscoveries, dusk } from '../worldState'
  import { landmarks, roadPaths, terrainHeight } from '../data/sunmereVale'
  import { createRiverGeometry, createRoadGeometry, createTerrainGeometry } from './geometry'
  import WorldModel from '../environment/WorldModel.svelte'
  import { gbaToonGradient } from '../render/retroPalette'

  const terrainGeometry = createTerrainGeometry()
  const roads = roadPaths.map((path, index) => ({
    id: `road-${index}`,
    geometry: createRoadGeometry(path, index === 0 ? 1.5 : 1.08),
  }))

  const riverBankGeometry = createRiverGeometry(7.4, -0.56)
  const waterGeometry = createRiverGeometry(5.35, -0.43)
  const waterMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new Color('#2f6975') },
      uShallow: { value: new Color('#68a9a5') },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vWave;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        vWave = sin(p.x * .42 + uTime * 1.35) * .5 + sin(p.x * .16 - uTime * .7) * .5;
        p.y += floor(vWave * 4.0) * .014;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vWave;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      float bayer2(vec2 pixel) {
        vec2 p = mod(floor(pixel), 2.0);
        return (p.x + p.y * 2.0 == 0.0) ? 0.0 :
               (p.x + p.y * 2.0 == 1.0) ? 0.5 :
               (p.x + p.y * 2.0 == 2.0) ? 0.75 : 0.25;
      }
      void main() {
        float ribbons = smoothstep(.77, .97, sin((vUv.x * 1.35) + vWave * 2.0) * .5 + .5);
        float edge = min(vUv.y, 1.0 - vUv.y);
        float foam = (1.0 - smoothstep(0.025, 0.16, edge)) * (0.48 + ribbons * 0.42);
        vec3 color = mix(uDeep, uShallow, .28 + vUv.y * .4 + ribbons * .2);
        color = mix(color, vec3(0.91, 0.87, 0.67), foam);
        float dither = bayer2(gl_FragCoord.xy) - 0.5;
        color = floor(clamp(color + dither / 18.0, 0.0, 1.0) * 12.0) / 12.0;
        gl_FragColor = vec4(color, .86);
      }
    `,
  })

  const glowGeometry = new SphereGeometry(0.34, 12, 8)
  const glowMaterial = new MeshBasicMaterial({
    color: '#ffd780',
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
  })
  const ringGeometry = new CircleGeometry(1.7, 48)

  useTask((delta) => {
    waterMaterial.uniforms.uTime.value += delta
  })
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

<T.Mesh geometry={riverBankGeometry} receiveShadow renderOrder={0}>
  <T.MeshToonMaterial color="#827957" gradientMap={gbaToonGradient} />
</T.Mesh>

<T.Mesh
  geometry={waterGeometry}
  material={waterMaterial}
  renderOrder={1}
/>

<T.Mesh geometry={ringGeometry} position={[-20, terrainHeight(-20, -16) + 0.09, -16]} rotation={[-Math.PI / 2, 0, 0]}>
  <T.MeshBasicMaterial color="#c9a85c" transparent opacity={$completedDiscoveries.has('shrine') ? 0.55 : 0.12} />
</T.Mesh>

{#each landmarks as landmark (landmark.id)}
  <WorldModel
    url={landmark.model}
    position={[
      landmark.position[0],
      terrainHeight(landmark.position[0], landmark.position[2]) + landmark.position[1],
      landmark.position[2],
    ]}
    rotation={landmark.rotation}
    scale={landmark.scale}
    muted={landmark.id === 'far-castle'}
    stripHighRoof={landmark.id === 'silverrun-bridge'}
  />
{/each}

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

{#if $dusk}
  <T.PointLight position={[-7, terrainHeight(-7, 9) + 4, 9]} color="#ffb46a" intensity={18} distance={14} />
  <T.PointLight position={[-15, terrainHeight(-15, 12) + 3.4, 12]} color="#ffb46a" intensity={12} distance={11} />
{/if}
