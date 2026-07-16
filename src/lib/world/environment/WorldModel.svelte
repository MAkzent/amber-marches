<script lang="ts">
  import { GLTF, type ThrelteGltf } from '@threlte/extras'
  import { Color, type Material, type Mesh, MeshStandardMaterial, MeshToonMaterial } from 'three'
  import { gbaToonGradient } from '../render/retroPalette'

  type Props = {
    url: string
    position: [number, number, number]
    rotation?: [number, number, number]
    scale?: number | [number, number, number]
    muted?: boolean
  }

  let {
    url,
    position,
    rotation = [0, 0, 0],
    scale = 1,
    muted = false,
  }: Props = $props()

  const scaleVec = $derived(
    typeof scale === 'number' ? ([scale, scale, scale] as [number, number, number]) : scale,
  )

  function prepare(gltf: ThrelteGltf) {
    gltf.scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true

      const source = mesh.material as Material
      if (source instanceof MeshStandardMaterial) {
        const material = new MeshToonMaterial({
          color: source.color.clone(),
          map: source.map,
          gradientMap: gbaToonGradient,
          transparent: source.transparent,
          opacity: source.opacity,
          alphaTest: source.alphaTest,
          side: source.side,
          vertexColors: source.vertexColors,
        })
        if (muted) material.color.lerp(new Color('#798169'), 0.42)
        mesh.material = material
      }
    })

  }
</script>

<GLTF
  {url}
  {position}
  {rotation}
  scale={scaleVec}
  onload={prepare}
/>
