<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import { Group, type Mesh, type Object3D } from 'three'
  import { getWindTime, treeWindLean } from '../atmosphere/wind'
  import { reducedMotion } from '../worldState'

  type Props = {
    url: string
    position: [number, number, number]
    rotation?: [number, number, number]
    scale?: number
    /** 0–1 phase so neighboring trees don't sway in lockstep. */
    phase?: number
  }

  let { url, position, rotation = [0, 0, 0], scale = 1, phase = 0 }: Props = $props()

  const { load } = useGltf()
  let scene = $state<Object3D>()
  const pivot = new Group()

  $effect(() => {
    const store = load(url)
    const unsubscribe = store.subscribe((data) => {
      if (!data) return
      // useGltf caches by URL — clone so each placement gets its own transform.
      const clone = data.scene.clone(true)
      clone.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = true
        mesh.receiveShadow = true
      })
      scene = clone
    })
    return unsubscribe
  })

  useTask(() => {
    if (!scene) return
    if ($reducedMotion) {
      pivot.rotation.x = 0
      pivot.rotation.z = 0
      return
    }
    const lean = treeWindLean(getWindTime(), phase)
    pivot.rotation.x = lean.x
    pivot.rotation.z = lean.z
  })
</script>

<T is={pivot} {position}>
  {#if scene}
    <T is={scene} {rotation} scale={[scale, scale, scale]} />
  {/if}
</T>
