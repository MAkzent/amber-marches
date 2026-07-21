<script lang="ts">
  import { T } from '@threlte/core'
  import { completedDiscoveries, discoveries } from '../worldState'
  import { walkHeight } from '../data/sunmereVale'

  const tower = discoveries.find((discovery) => discovery.id === 'watchtower')
</script>

{#if tower && !$completedDiscoveries.has('watchtower')}
  <T.Group position={[tower.position[0], walkHeight(...tower.position), tower.position[1]]}>
    <T.Mesh rotation.x={-Math.PI / 2} position.y={0.04}>
      <T.CircleGeometry args={[0.72, 28]} />
      <T.MeshBasicMaterial color="#e2c274" transparent opacity={0.16} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position.y={1.85}>
      <T.OctahedronGeometry args={[0.22, 0]} />
      <T.MeshBasicMaterial color="#ffe09a" transparent opacity={0.9} depthWrite={false} />
    </T.Mesh>
  </T.Group>
{/if}
