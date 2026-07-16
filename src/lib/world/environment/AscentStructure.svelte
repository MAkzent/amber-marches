<script lang="ts">
  /**
   * Open procedural stonework for the Whispering Ascent. The same descriptors
   * drive these Three.js boxes and the analytical walk profile, so no imported
   * model scale or pivot can turn the stairs into a roof-like structure.
   */
  import { T } from '@threlte/core'
  import { ascentStones, type AscentStone } from '../data/mysteriousStairs'
  import { gbaToonGradient } from '../render/retroPalette'

  const treadPalette = ['#817b70', '#8b8376', '#756f67', '#928778'] as const
  const curbPalette = ['#68665f', '#747068', '#615f5a', '#7b756a'] as const

  function stoneColor(stone: AscentStone) {
    const palette = stone.kind === 'tread' ? treadPalette : curbPalette
    return palette[stone.variant % palette.length]
  }
</script>

{#each ascentStones as stone (stone.id)}
  <T.Mesh
    position={stone.position}
    rotation={stone.rotation}
    castShadow
    receiveShadow
  >
    <T.BoxGeometry args={stone.size} />
    <T.MeshToonMaterial
      color={stoneColor(stone)}
      gradientMap={gbaToonGradient}
    />
  </T.Mesh>
{/each}
