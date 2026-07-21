<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    DodecahedronGeometry,
    DynamicDrawUsage,
    InstancedMesh,
    MeshToonMaterial,
    Object3D,
    Points,
    PointsMaterial,
    BufferGeometry,
    Float32BufferAttribute,
  } from 'three'
  import { scenery } from '../data/amberMarches'
  import { terrainHeight } from '../data/amberMarches'
  import { WIND, getWindTime, windEnvelope } from '../atmosphere/wind'
  import { gbaToonGradient } from '../render/retroPalette'
  import { reducedMotion, weatherMode } from '../worldState'
  import { battleHud, ENCOUNTER_ORIGIN } from '../battle'
  import NatureTree from './NatureTree.svelte'

  /** Soft-clear trees near the hex board as the battle stage settles in. */
  const BATTLE_TREE_CLEAR_RADIUS = 18

  function treeBattleOpacity(x: number, z: number) {
    const blend = $battleHud.stageBlend
    if (blend < 0.01) return 1
    const dist = Math.hypot(x - ENCOUNTER_ORIGIN.x, z - ENCOUNTER_ORIGIN.z)
    if (dist >= BATTLE_TREE_CLEAR_RADIUS) return 1
    // Inner trees fade fully; edge of the clear ring keeps a soft silhouette.
    const edge = dist / BATTLE_TREE_CLEAR_RADIUS
    const clear = 1 - edge * edge
    return Math.max(0, 1 - blend * clear)
  }

  const OAK_MODELS = [
    '/assets/cc0/quaternius-nature/glTF/CommonTree_1.gltf',
    '/assets/cc0/quaternius-nature/glTF/CommonTree_2.gltf',
    '/assets/cc0/quaternius-nature/glTF/CommonTree_3.gltf',
    '/assets/cc0/quaternius-nature/glTF/CommonTree_4.gltf',
    '/assets/cc0/quaternius-nature/glTF/CommonTree_5.gltf',
  ] as const

  const PINE_MODELS = [
    '/assets/cc0/quaternius-nature/glTF/Pine_1.gltf',
    '/assets/cc0/quaternius-nature/glTF/Pine_2.gltf',
    '/assets/cc0/quaternius-nature/glTF/Pine_3.gltf',
    '/assets/cc0/quaternius-nature/glTF/Pine_4.gltf',
    '/assets/cc0/quaternius-nature/glTF/Pine_5.gltf',
  ] as const

  /** Quaternius trees are ~7m tall; scale them into the valley silhouette. */
  const TREE_SCALE = 0.58

  const oakPoints = scenery.filter((point) => point.kind === 'oak')
  const pinePoints = scenery.filter((point) => point.kind === 'pine')
  const rockPoints = scenery.filter((point) => point.kind === 'rock')

  const rockGeometry = new DodecahedronGeometry(0.78, 0)
  const rockMaterial = new MeshToonMaterial({ color: '#8b8d78', gradientMap: gbaToonGradient })
  const rocks = new InstancedMesh(rockGeometry, rockMaterial, rockPoints.length)
  const dummy = new Object3D()

  rocks.castShadow = true
  rocks.receiveShadow = true

  for (const [index, point] of rockPoints.entries()) {
    const y = terrainHeight(point.x, point.z)
    dummy.position.set(point.x, y + 0.45 * point.scale, point.z)
    dummy.scale.set(point.scale * 1.4, point.scale * 0.75, point.scale)
    dummy.rotation.set(point.hue, point.hue * Math.PI * 2, 0)
    dummy.updateMatrix()
    rocks.setMatrixAt(index, dummy.matrix)
  }

  const pollenCount = 220
  const pollenPositions = new Float32Array(pollenCount * 3)
  const pollenSeeds = new Float32Array(pollenCount)
  for (let index = 0; index < pollenCount; index += 1) {
    pollenPositions[index * 3] = (Math.random() - 0.5) * 70
    pollenPositions[index * 3 + 1] = 1 + Math.random() * 12
    pollenPositions[index * 3 + 2] = (Math.random() - 0.5) * 52
    pollenSeeds[index] = Math.random()
  }
  const pollenGeometry = new BufferGeometry()
  pollenGeometry.setAttribute('position', new Float32BufferAttribute(pollenPositions, 3))
  const pollenMaterial = new PointsMaterial({
    color: '#f8e0a0',
    size: 0.075,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  })
  const pollen = new Points(pollenGeometry, pollenMaterial)
  const pollenAttribute = pollen.geometry.getAttribute('position') as Float32BufferAttribute
  pollenAttribute.setUsage(DynamicDrawUsage)

  useTask((delta) => {
    if ($weatherMode === 'snow') {
      pollen.visible = false
      pollenMaterial.opacity = 0
      return
    }
    pollen.visible = true

    const motion = $reducedMotion ? 0.15 : 1
    const t = getWindTime()
    const { strength, gust, push } = windEnvelope(t)
    // Same along-wind push the canopy uses — no cross-breeze jitter.
    const drift = (2.8 + push * 3.2 + gust * 4) * delta * motion

    for (let index = 0; index < pollenCount; index += 1) {
      const i = index * 3
      const seed = pollenSeeds[index]
      const bob = Math.sin(t * 0.45 + seed * 14) * delta * 0.12 * motion
      pollenPositions[i] += WIND.dirX * (drift + bob)
      pollenPositions[i + 1] += Math.sin(t * 0.35 + seed * 10) * delta * 0.2 * motion
      pollenPositions[i + 2] += WIND.dirZ * (drift + bob)

      if (pollenPositions[i] > 35) pollenPositions[i] -= 70
      if (pollenPositions[i] < -35) pollenPositions[i] += 70
      if (pollenPositions[i + 2] > 26) pollenPositions[i + 2] -= 52
      if (pollenPositions[i + 2] < -26) pollenPositions[i + 2] += 52
      if (pollenPositions[i + 1] > 13) pollenPositions[i + 1] = 1 + seed * 2
      if (pollenPositions[i + 1] < 0.6) pollenPositions[i + 1] = 12
    }
    pollenAttribute.needsUpdate = true
    const battleClarity = 1 - $battleHud.stageBlend * 0.85
    pollenMaterial.opacity = (0.36 + strength * 0.14) * battleClarity
  })

  function treeScale(pointScale: number) {
    return TREE_SCALE * pointScale
  }

  function variantIndex(hue: number, count: number) {
    return Math.min(count - 1, Math.floor(hue * count))
  }
</script>

{#each oakPoints as point, index (index)}
  <NatureTree
    url={OAK_MODELS[variantIndex(point.hue, OAK_MODELS.length)]}
    position={[point.x, terrainHeight(point.x, point.z), point.z]}
    rotation={[0, point.hue * Math.PI * 2, 0]}
    scale={treeScale(point.scale)}
    phase={point.hue}
    opacityMul={treeBattleOpacity(point.x, point.z)}
  />
{/each}

{#each pinePoints as point, index (index)}
  <NatureTree
    url={PINE_MODELS[variantIndex(point.hue, PINE_MODELS.length)]}
    position={[point.x, terrainHeight(point.x, point.z), point.z]}
    rotation={[0, point.hue * Math.PI * 2, 0]}
    scale={treeScale(point.scale)}
    phase={point.hue}
    opacityMul={treeBattleOpacity(point.x, point.z)}
  />
{/each}

<T is={rocks} />
<T is={pollen} />
