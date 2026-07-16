<script lang="ts">
  import { GLTF, type ThrelteGltf } from '@threlte/extras'
  import { Color, type Material, type Mesh, MeshStandardMaterial, MeshToonMaterial } from 'three'
  import { gbaToonGradient } from '../render/retroPalette'

  type Props = {
    url: string
    position: [number, number, number]
    rotation?: [number, number, number]
    scale?: number
    muted?: boolean
    /** Drop roof-board primitives so billboard heroes can cross without clipping. */
    stripHighRoof?: boolean
  }

  let {
    url,
    position,
    rotation = [0, 0, 0],
    scale = 1,
    muted = false,
    stripHighRoof = false,
  }: Props = $props()

  function prepare(gltf: ThrelteGltf) {
    const roofMeshes: Mesh[] = []
    gltf.scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true

      if (stripHighRoof && mesh.geometry) {
        mesh.geometry.computeBoundingBox()
        const box = mesh.geometry.boundingBox
        // KayKit roofed bridge: roof boards live above local y ≈ 0.2.
        if (box && box.min.y > 0.18) roofMeshes.push(mesh)
      }

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

    for (const mesh of roofMeshes) {
      mesh.removeFromParent()
      mesh.geometry.dispose()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((entry) => entry.dispose())
      else mat.dispose()
    }
  }
</script>

<GLTF
  {url}
  {position}
  {rotation}
  scale={[scale, scale, scale]}
  onload={prepare}
/>
