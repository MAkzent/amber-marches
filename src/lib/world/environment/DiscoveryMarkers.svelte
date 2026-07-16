<script lang="ts">
  import { T } from '@threlte/core'
  import { Float } from '@threlte/extras'
  import { CircleGeometry, OctahedronGeometry, TorusGeometry } from 'three'
  import { completedDiscoveries, discoveries } from '../worldState'
  import { walkHeight } from '../data/sunmereVale'

  const diamondGeometry = new OctahedronGeometry(0.28, 0)
  const ringGeometry = new TorusGeometry(0.55, 0.035, 8, 36)
  const groundGeometry = new CircleGeometry(0.72, 40)
  const lanternPath: Array<[number, number]> = [
    [-5, 5],
    [-1, 2],
    [3, -1],
    [10, -7],
    [15, -13],
    [-5, -9],
    [-12, -12],
  ]
</script>

{#each discoveries as discovery (discovery.id)}
  {#if !$completedDiscoveries.has(discovery.id) && discovery.id !== 'villager'}
    <T.Group position={[discovery.position[0], walkHeight(...discovery.position), discovery.position[1]]}>
      <T.Mesh geometry={groundGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <T.MeshBasicMaterial color="#e2c274" transparent opacity={0.16} depthWrite={false} />
      </T.Mesh>
      <Float speed={1.25} rotationIntensity={0.25} floatingRange={[0.1, 0.35]}>
        <T.Group position={[0, 2.35, 0]}>
          <T.Mesh geometry={diamondGeometry}>
            <T.MeshBasicMaterial color="#ffe09a" />
          </T.Mesh>
          <T.Mesh geometry={ringGeometry} rotation={[Math.PI / 2, 0, 0]}>
            <T.MeshBasicMaterial color="#e3c371" transparent opacity={0.68} />
          </T.Mesh>
        </T.Group>
      </Float>
    </T.Group>
  {/if}
{/each}

{#if $completedDiscoveries.has('villager')}
  {#each lanternPath as point}
    <T.Group position={[point[0], walkHeight(...point), point[1]]}>
      <T.Mesh position={[0, 0.65, 0]} castShadow>
        <T.CylinderGeometry args={[0.05, 0.08, 1.3, 6]} />
        <T.MeshStandardMaterial color="#493a2b" roughness={1} />
      </T.Mesh>
      <T.Mesh position={[0, 1.35, 0]}>
        <T.SphereGeometry args={[0.12, 8, 6]} />
        <T.MeshBasicMaterial color="#ffd27d" />
      </T.Mesh>
      <T.PointLight position={[0, 1.35, 0]} color="#ffc465" intensity={3.5} distance={4} />
    </T.Group>
  {/each}
{/if}
