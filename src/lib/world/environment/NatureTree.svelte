<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import { Box3, Group, type Material, type Mesh, type Object3D, Sphere } from 'three'
  import { getWindTime, treeWindLean } from '../atmosphere/wind'
  import { partyLive, reducedMotion } from '../worldState'
  import { treeActuallyOccludesCharacter, treeOcclusionOpacity } from './treeOcclusion'

  type Props = {
    url: string
    position: [number, number, number]
    rotation?: [number, number, number]
    scale?: number
    /** 0–1 phase so neighboring trees don't sway in lockstep. */
    phase?: number
    /** Extra multiplier (e.g. soft battle clear). 1 = fully visible. */
    opacityMul?: number
  }

  let {
    url,
    position,
    rotation = [0, 0, 0],
    scale = 1,
    phase = 0,
    opacityMul = 1,
  }: Props = $props()

  const { load } = useGltf()
  const { camera } = useThrelte()
  let scene = $state<Object3D>()
  const pivot = new Group()
  const localBounds = new Sphere()
  const worldBounds = new Sphere()
  const materialStates: Array<{
    material: Material
    opacity: number
    transparent: boolean
    depthWrite: boolean
  }> = []
  const meshStates: Array<{
    mesh: Mesh
    renderOrder: number
    castShadow: boolean
  }> = []
  let boundsReady = false
  let currentOpacity = 1
  let transparentMode = false
  let shadowsEnabled = true

  const FADED_TREE_RENDER_ORDER = 5
  const FADE_IN_RATE = 14
  const FADE_OUT_RATE = 6

  function setTransparentMode(enabled: boolean) {
    if (transparentMode === enabled) return
    transparentMode = enabled

    for (const state of materialStates) {
      state.material.transparent = enabled || state.transparent
      state.material.depthWrite = enabled ? false : state.depthWrite
      state.material.needsUpdate = true
    }
    for (const state of meshStates) {
      state.mesh.renderOrder = enabled ? FADED_TREE_RENDER_ORDER : state.renderOrder
    }
  }

  function applyOpacity(opacity: number) {
    for (const state of materialStates) {
      state.material.opacity = state.opacity * opacity
    }
  }

  function setShadowMode(enabled: boolean) {
    if (shadowsEnabled === enabled) return
    shadowsEnabled = enabled
    for (const state of meshStates) {
      state.mesh.castShadow = enabled && state.castShadow
    }
  }

  $effect(() => {
    const store = load(url)
    let clone: Object3D | undefined
    const unsubscribe = store.subscribe((data) => {
      if (!data) return
      // useGltf caches by URL — clone so each placement gets its own transform.
      clone = data.scene.clone(true)
      const materialClones = new Map<Material, Material>()
      clone.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = true
        mesh.receiveShadow = true

        const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        const cloned = sourceMaterials.map((source) => {
          const cached = materialClones.get(source)
          if (cached) return cached
          const material = source.clone()
          materialClones.set(source, material)
          materialStates.push({
            material,
            opacity: material.opacity,
            transparent: material.transparent,
            depthWrite: material.depthWrite,
          })
          return material
        })
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
        meshStates.push({
          mesh,
          renderOrder: mesh.renderOrder,
          castShadow: mesh.castShadow,
        })
      })

      new Box3().setFromObject(clone).getBoundingSphere(localBounds)
      boundsReady = !localBounds.isEmpty()
      scene = clone
    })
    return () => {
      unsubscribe()
      if (scene === clone) scene = undefined
      for (const state of materialStates) state.material.dispose()
      materialStates.length = 0
      meshStates.length = 0
      boundsReady = false
      currentOpacity = 1
      transparentMode = false
      shadowsEnabled = true
    }
  })

  useTask((delta) => {
    if (!scene) return
    if ($reducedMotion) {
      pivot.rotation.x = 0
      pivot.rotation.z = 0
    } else {
      const lean = treeWindLean(getWindTime(), phase)
      pivot.rotation.x = lean.x
      pivot.rotation.z = lean.z
    }

    if (!boundsReady) return
    pivot.updateWorldMatrix(true, true)
    worldBounds.copy(localBounds).applyMatrix4(scene.matrixWorld)
    const controlledCharacter = partyLive[0]
    const candidateOpacity = controlledCharacter
      ? treeOcclusionOpacity(camera.current.position, worldBounds, controlledCharacter)
      : 1
    const occlusionTarget =
      controlledCharacter &&
      candidateOpacity < 1 &&
      treeActuallyOccludesCharacter(scene, camera.current.position, controlledCharacter)
        ? candidateOpacity
        : 1
    const targetOpacity = occlusionTarget * Math.max(0, Math.min(1, opacityMul))

    if ($reducedMotion) {
      currentOpacity = targetOpacity
    } else {
      const rate = targetOpacity < currentOpacity ? FADE_IN_RATE : FADE_OUT_RATE
      currentOpacity +=
        (targetOpacity - currentOpacity) * (1 - Math.exp(-rate * Math.min(delta, 0.1)))
    }
    if (Math.abs(currentOpacity - targetOpacity) < 0.002) currentOpacity = targetOpacity

    const shouldBlend = targetOpacity < 0.999 || currentOpacity < 0.995
    setTransparentMode(shouldBlend)
    applyOpacity(currentOpacity)
    // Transparent tree materials still render opaque shadow-map silhouettes.
    // Use hysteresis so battle-cleared trees cannot leave giant stale shadows.
    setShadowMode(
      shadowsEnabled
        ? currentOpacity > 0.3
        : currentOpacity > 0.62,
    )
    pivot.visible = currentOpacity > 0.02
  })
</script>

<T is={pivot} {position}>
  {#if scene}
    <T is={scene} {rotation} scale={[scale, scale, scale]} />
  {/if}
</T>
