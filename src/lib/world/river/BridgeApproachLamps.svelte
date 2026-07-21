<script lang="ts">
  import { T } from '@threlte/core'
  import { bridgeApproachLanterns, walkHeight } from '../data/amberMarches'
  import { gbaToonGradient } from '../render/retroPalette'
</script>

{#each bridgeApproachLanterns as point}
  <T.Group position={[point[0], walkHeight(...point), point[1]]}>
    <!-- Pedestal -->
    <T.Mesh position={[0, 0.08, 0]} castShadow receiveShadow>
      <T.BoxGeometry args={[0.42, 0.16, 0.42]} />
      <T.MeshToonMaterial color="#5c5348" gradientMap={gbaToonGradient} />
    </T.Mesh>
    <!-- Shaft -->
    <T.Mesh position={[0, 0.48, 0]} castShadow>
      <T.BoxGeometry args={[0.16, 0.64, 0.16]} />
      <T.MeshToonMaterial color="#4a4036" gradientMap={gbaToonGradient} />
    </T.Mesh>
    <!-- Platform under chamber -->
    <T.Mesh position={[0, 0.86, 0]} castShadow>
      <T.BoxGeometry args={[0.34, 0.08, 0.34]} />
      <T.MeshToonMaterial color="#5c5348" gradientMap={gbaToonGradient} />
    </T.Mesh>
    <!-- Lantern chamber frame -->
    <T.Mesh position={[0, 1.08, 0]} castShadow>
      <T.BoxGeometry args={[0.28, 0.36, 0.28]} />
      <T.MeshToonMaterial color="#3d342c" gradientMap={gbaToonGradient} />
    </T.Mesh>
    <!-- Warm glow inside chamber -->
    <T.Mesh position={[0, 1.08, 0]}>
      <T.BoxGeometry args={[0.18, 0.26, 0.18]} />
      <T.MeshBasicMaterial color="#ffd27d" />
    </T.Mesh>
    <!-- Pagoda roof -->
    <T.Mesh position={[0, 1.34, 0]} castShadow>
      <T.BoxGeometry args={[0.48, 0.1, 0.48]} />
      <T.MeshToonMaterial color="#6b3a2e" gradientMap={gbaToonGradient} />
    </T.Mesh>
    <T.Mesh position={[0, 1.44, 0]} castShadow>
      <T.BoxGeometry args={[0.28, 0.1, 0.28]} />
      <T.MeshToonMaterial color="#5a3126" gradientMap={gbaToonGradient} />
    </T.Mesh>
    <!-- Finial -->
    <T.Mesh position={[0, 1.56, 0]}>
      <T.BoxGeometry args={[0.08, 0.14, 0.08]} />
      <T.MeshToonMaterial color="#887d68" gradientMap={gbaToonGradient} />
    </T.Mesh>
    <T.PointLight position={[0, 1.1, 0]} color="#ffc465" intensity={2.4} distance={3.5} />
  </T.Group>
{/each}
