<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import { onDestroy } from 'svelte'
  import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
  import type { BufferGeometry, Mesh } from 'three'
  import { HERO_RADIUS } from '../collision'
  import { getWindTime, windEnvelope } from '../atmosphere/wind'
  import { get } from 'svelte/store'
  import { graphicsTier, partyLive, reducedMotion } from '../worldState'
  import { battleHud, ENCOUNTER_ORIGIN } from '../battle'
  import {
    createKenneyGrassField,
    GRASS_STEP_DESKTOP,
    GRASS_STEP_MOBILE,
    KENNEY_GRASS_LEAFS_URL,
    KENNEY_GRASS_URL,
    MAX_BENDERS,
    sampleGrassTufts,
    type GrassBender,
    type GrassFieldHandle,
  } from './grassField'

  let field = $state<GrassFieldHandle | null>(null)
  const benders: GrassBender[] = Array.from({ length: MAX_BENDERS }, () => ({
    x: 0,
    z: 0,
    r: 0,
  }))

  const FOOT_RADIUS = HERO_RADIUS * 1.15
  const PRINT_LIFE = 0.45
  const PRINT_SPACING = 0.55
  const PRINT_RADIUS = HERO_RADIUS * 0.85
  const MAX_PRINTS = MAX_BENDERS - 4

  type Footprint = { x: number; z: number; life: number }
  const footprints: Footprint[] = []
  const lastStamp = partyLive.map((hero) => ({ x: hero.x, z: hero.z }))

  function firstMeshGeometry(gltf: GLTF): BufferGeometry {
    let geometry: BufferGeometry | null = null
    gltf.scene.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh && mesh.geometry && !geometry) {
        geometry = mesh.geometry
      }
    })
    if (!geometry) throw new Error('Kenney grass GLB has no mesh geometry')
    return geometry
  }

  const loader = new GLTFLoader()
  Promise.all([loader.loadAsync(KENNEY_GRASS_URL), loader.loadAsync(KENNEY_GRASS_LEAFS_URL)])
    .then(([grassGltf, leafGltf]) => {
      const step =
        get(graphicsTier) === 'mobile' ? GRASS_STEP_MOBILE : GRASS_STEP_DESKTOP
      field = createKenneyGrassField(
        firstMeshGeometry(grassGltf),
        firstMeshGeometry(leafGltf),
        sampleGrassTufts(step),
      )
    })
    .catch((error) => {
      console.error('Failed to load Kenney grass assets', error)
    })

  useTask((delta) => {
    if (!field) return
    const motion = $reducedMotion ? 0.12 : 1
    const t = getWindTime()
    const { strength, push } = windEnvelope(t)
    field.setTime(t)
    // Soft carpet breeze — keep well below the old wheat-field lean.
    field.setWindStrength((0.18 + push * 0.12 + strength * 0.06) * motion)
    field.setBattleClear($battleHud.stageBlend, ENCOUNTER_ORIGIN.x, ENCOUNTER_ORIGIN.z)

    for (let i = 0; i < partyLive.length; i += 1) {
      const hero = partyLive[i]
      if (!hero) continue
      const prev = lastStamp[i] ?? (lastStamp[i] = { x: hero.x, z: hero.z })
      const moved = Math.hypot(hero.x - prev.x, hero.z - prev.z)
      if (moved >= PRINT_SPACING) {
        // Don't stamp on top of a live foot — that doubled the press field.
        let nearLive = false
        for (let h = 0; h < partyLive.length; h += 1) {
          const other = partyLive[h]
          if (!other) continue
          if (Math.hypot(prev.x - other.x, prev.z - other.z) < FOOT_RADIUS * 0.85) {
            nearLive = true
            break
          }
        }
        if (!nearLive) footprints.push({ x: prev.x, z: prev.z, life: PRINT_LIFE })
        prev.x = hero.x
        prev.z = hero.z
        while (footprints.length > MAX_PRINTS) footprints.shift()
      }
    }

    for (let i = footprints.length - 1; i >= 0; i -= 1) {
      footprints[i].life -= delta
      if (footprints[i].life <= 0) footprints.splice(i, 1)
    }

    for (let i = 0; i < MAX_BENDERS; i += 1) benders[i].r = 0

    for (let i = 0; i < 4; i += 1) {
      const hero = partyLive[i]
      if (!hero) continue
      benders[i].x = hero.x
      benders[i].z = hero.z
      benders[i].r = FOOT_RADIUS
    }

    for (let i = 0; i < footprints.length && i < MAX_PRINTS; i += 1) {
      const print = footprints[i]
      const slot = benders[4 + i]
      const fade = Math.max(0, print.life / PRINT_LIFE)
      slot.x = print.x
      slot.z = print.z
      slot.r = PRINT_RADIUS * fade * 0.7
    }

    field.setBenders(benders)
  })

  onDestroy(() => {
    field?.dispose()
    field = null
  })
</script>

{#if field}
  <T is={field.root} />
{/if}
