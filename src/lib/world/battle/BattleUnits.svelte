<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core'
  import { onMount } from 'svelte'
  import {
    Color,
    Mesh,
    MeshBasicMaterial,
    NearestFilter,
    Raycaster,
    SRGBColorSpace,
    SphereGeometry,
    TextureLoader,
    Vector2,
    Vector3,
    type Texture,
  } from 'three'
  import {
    hexBattleDriver,
    hexToWorldXZ,
    type BattleActorKind,
    type MirrorUnit,
    type SimEvent,
  } from '../../battle'
  import { createPseudo3DSprite, type Pseudo3DSprite } from '../actors/pseudo3dSprite'
  import {
    FRAME_HEIGHT,
    facingForVelocity,
    facingRow,
    frameUv,
    oneShotFrameIndex,
    textureColumns,
    textureRows,
    type Facing,
  } from '../actors/spriteSheet'
  import { dusk, reducedMotion } from '../worldState'
  import { combatDelta, pushCombatImpact } from '../combat'
  import { BATTLE_SPRITE_CATALOG } from './actorCatalog'
  import {
    battleGroundY,
    battleHud,
    getBattleActorOpacity,
    getMarchPoses,
    publishBattleDamage,
    publishBattleVitals,
    shouldRenderBattleUnits,
    shouldShowBattleUnitVitals,
    tickBattleBridge,
    type BattleDamage,
    type BattleVital,
  } from './battleBridge'
  import { pickBattleHex } from './battlePicking'
  import { placementHighlight } from './placementHighlight'

  type UnitMotion = 'idle' | 'walk' | 'jump' | 'attack' | 'die' | 'dead'
  type UnitHandle = {
    id: string
    actorId: BattleActorKind
    team: 'hero' | 'enemy'
    sprite: Pseudo3DSprite
    textures: {
      idle: Texture
      walk: Texture
      jump?: Texture
      attack?: Texture
      die?: Texture
    }
    cardHeight: number
    motion: UnitMotion
    motionElapsed: number
    facing: Facing
    flash: number
    dead: boolean
  }
  type ProjectileFx = {
    id: number
    mesh: Mesh
    from: Vector3
    to: Vector3
    age: number
    duration: number
  }
  type DamagePop = {
    id: number
    targetId: string
    amount: number
    age: number
    defeated: boolean
  }

  const CARD_ASPECT = 0.72
  const FEET_FROM_TOP = 19
  const loader = new TextureLoader()
  const dayTint = new Color('#eee4d2')
  const duskTint = new Color('#c6a1b0')
  const hitTint = new Color('#fff2bc')
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const headProjection = new Vector3()
  const { camera, canvas } = useThrelte()
  const projectileGeometry = new SphereGeometry(0.11, 6, 4)
  const projectileMaterial = new MeshBasicMaterial({
    color: '#ffe08a',
    toneMapped: false,
  })

  let handles = $state<UnitHandle[]>([])
  let projectiles = $state<ProjectileFx[]>([])
  let damagePops = $state<DamagePop[]>([])
  let effectSerial = 0
  let dragId: string | null = null
  let dragWorld = { x: 0, z: 0 }

  function loadTexture(url: string) {
    const texture = loader.load(url)
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    texture.generateMipmaps = false
    texture.colorSpace = SRGBColorSpace
    return texture
  }

  function createHandle(unit: MirrorUnit): UnitHandle {
    const kind = unit.actorId as BattleActorKind
    const catalog = BATTLE_SPRITE_CATALOG[kind]
    const textures = {
      idle: loadTexture(catalog.idle),
      walk: loadTexture(catalog.walk),
      jump: catalog.jump ? loadTexture(catalog.jump) : undefined,
      attack: catalog.attack ? loadTexture(catalog.attack) : undefined,
      die: catalog.die ? loadTexture(catalog.die) : undefined,
    }
    const sprite = createPseudo3DSprite({
      map: textures.idle,
      height: catalog.cardHeight,
      width: catalog.cardHeight * CARD_ASPECT,
      radius: catalog.radius,
      bodyBaseY: -((FRAME_HEIGHT - FEET_FROM_TOP) / FRAME_HEIGHT) * catalog.cardHeight,
    })
    sprite.root.userData.battleUnitId = unit.id
    sprite.root.userData.battleTeam = unit.team
    sprite.plant(unit.x, unit.z, battleGroundY(unit.x, unit.z))
    return {
      id: unit.id,
      actorId: kind,
      team: unit.team,
      sprite,
      textures,
      cardHeight: catalog.cardHeight,
      motion: 'idle',
      motionElapsed: 0,
      // Left-to-right board: heroes face east (right), enemies face west (left).
      facing: unit.team === 'hero' ? 'front-right' : 'front-left',
      flash: 0,
      dead: false,
    }
  }

  function projectHead(x: number, z: number, sprite: Pseudo3DSprite) {
    // Match the billboard card top (bodyBaseY seats feet on the ground).
    const y = battleGroundY(x, z) + sprite.bodyBaseY + sprite.height
    headProjection.set(x, y, z).project(camera.current)
    return {
      screenX: headProjection.x * 0.5 + 0.5,
      screenY: -headProjection.y * 0.5 + 0.5,
      onScreen:
        headProjection.z > -1 &&
        headProjection.z < 1 &&
        Math.abs(headProjection.x) < 0.92 &&
        headProjection.y > -0.9 &&
        headProjection.y < 0.78,
    }
  }

  function syncRoster(units: MirrorUnit[], marchStarts?: Map<string, { x: number; z: number }>) {
    const ids = new Set(units.map((u) => u.id))
    handles = handles.filter((h) => {
      if (ids.has(h.id)) return true
      h.sprite.root.visible = false
      return false
    })
    for (const unit of units) {
      if (!handles.some((h) => h.id === unit.id)) {
        const handle = createHandle(unit)
        const start = marchStarts?.get(unit.id)
        if (start) {
          handle.sprite.plant(start.x, start.z, battleGroundY(start.x, start.z))
        }
        handles = [...handles, handle]
      }
    }
  }

  function setMotion(handle: UnitHandle, motion: UnitMotion) {
    if (handle.motion === motion) return
    handle.motion = motion
    handle.motionElapsed = 0
  }

  function onEvents(events: SimEvent[]) {
    for (const ev of events) {
      if (ev.type === 'attackStart') {
        const handle = handles.find((h) => h.id === ev.unitId)
        const target = handles.find((h) => h.id === ev.targetId)
        if (handle && target) {
          handle.facing = facingForVelocity(
            target.sprite.root.position.x - handle.sprite.root.position.x,
            target.sprite.root.position.z - handle.sprite.root.position.z,
            handle.facing,
          )
          setMotion(handle, handle.textures.attack ? 'attack' : 'walk')
        }
      } else if (ev.type === 'projectile') {
        const source = handles.find((handle) => handle.id === ev.unitId)
        const target = handles.find((handle) => handle.id === ev.targetId)
        if (source && target) {
          const from = source.sprite.root.position.clone()
          const to = target.sprite.root.position.clone()
          from.y += source.cardHeight * 0.45
          to.y += target.cardHeight * 0.42
          const mesh = new Mesh(projectileGeometry, projectileMaterial)
          mesh.position.copy(from)
          mesh.renderOrder = 8
          projectiles = [
            ...projectiles,
            {
              id: ++effectSerial,
              mesh,
              from,
              to,
              age: 0,
              duration: Math.max(0.08, ev.flightSeconds),
            },
          ]
        }
      } else if (ev.type === 'hit') {
        const target = handles.find((h) => h.id === ev.targetId)
        if (target) {
          target.flash = 0.14
          damagePops = [
            ...damagePops,
            {
              id: ++effectSerial,
              targetId: ev.targetId,
              amount: ev.amount,
              age: 0,
              defeated: false,
            },
          ]
          if (!$reducedMotion) {
            pushCombatImpact(
              target.sprite.root.position.x,
              target.sprite.root.position.z,
              0.7,
            )
          }
        }
      } else if (ev.type === 'die') {
        const handle = handles.find((h) => h.id === ev.unitId)
        if (handle) {
          handle.dead = true
          setMotion(handle, handle.textures.die ? 'die' : 'dead')
        }
        const recent = [...damagePops]
          .reverse()
          .find((damage) => damage.targetId === ev.unitId && damage.age < 0.2)
        if (recent) recent.defeated = true
      }
    }
  }

  function groundFromPointer(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera.current)
    if (!hexBattleDriver.isActive()) return null
    return pickBattleHex(raycaster.ray, {
      origin: hexBattleDriver.getOrigin(),
      boardRadius: hexBattleDriver.getBoardRadius(),
      hexSize: hexBattleDriver.getHexSize(),
    })
  }

  function unitAtPointer(clientX: number, clientY: number): UnitHandle | null {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera.current)
    const meshes = handles
      .filter((h) => h.team === 'hero' && !h.dead)
      .map((h) => h.sprite.mesh)
    const hits = raycaster.intersectObjects(meshes, false)
    if (!hits.length) return null
    const mesh = hits[0].object
    return handles.find((h) => h.sprite.mesh === mesh) ?? null
  }

  function onPointerDown(event: PointerEvent) {
    if (!$battleHud.placing) return
    const unit = unitAtPointer(event.clientX, event.clientY)
    if (!unit) return
    if (!hexBattleDriver.beginDrag(unit.id)) return
    dragId = unit.id
    dragWorld = { x: unit.sprite.root.position.x, z: unit.sprite.root.position.z }
    canvas.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragId) return
    const ground = groundFromPointer(event.clientX, event.clientY)
    if (!ground) {
      placementHighlight.set(null)
      return
    }
    const hex = ground.hex
    const valid = hexBattleDriver.isHeroDeployHex(hex)
    const center = hexToWorldXZ(
      hex,
      hexBattleDriver.getOrigin(),
      hexBattleDriver.getHexSize(),
    )
    dragWorld = valid ? center : { x: ground.x, z: ground.z }
    const targetId = hexBattleDriver.previewOpeningTarget(dragId, hex)
    placementHighlight.set({
      ...hex,
      valid,
      unitId: dragId,
      targetId,
    })
  }

  function onPointerUp(event: PointerEvent) {
    if (!dragId) return
    const ground = groundFromPointer(event.clientX, event.clientY)
    if (ground) {
      hexBattleDriver.moveUnit(dragId, ground.hex)
    }
    hexBattleDriver.endDrag()
    dragId = null
    placementHighlight.set(null)
    try {
      canvas.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  onMount(() => {
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      handles = []
      projectiles = []
      damagePops = []
      publishBattleDamage([])
      projectileGeometry.dispose()
      projectileMaterial.dispose()
    }
  })

  useTask((delta) => {
    const simDelta = $reducedMotion ? delta : combatDelta(delta)
    tickBattleBridge(simDelta, onEvents)

    if (!shouldRenderBattleUnits()) {
      if (handles.length) {
        for (const h of handles) h.sprite.root.visible = false
        handles = []
      }
      projectiles = []
      damagePops = []
      publishBattleDamage([])
      publishBattleVitals([])
      return
    }

    const units = hexBattleDriver.mirrorSnapshot()
    const marchPoses = getMarchPoses()
    const marchById = new Map(marchPoses.map((p) => [p.id, p]))
    if (handles.length === 0 && marchPoses.length) {
      syncRoster(
        units,
        new Map(marchPoses.map((p) => [p.id, { x: p.x, z: p.z }])),
      )
    } else {
      syncRoster(units)
    }

    const vitals: BattleVital[] = []
    const actorOpacity = getBattleActorOpacity()
    // WorldCamera just wrote position/lookAt; refresh before screen projection.
    camera.current.updateMatrixWorld()

    for (const unit of units) {
      const handle = handles.find((h) => h.id === unit.id)
      if (!handle) continue

      const march = marchById.get(unit.id)
      let x = unit.x
      let z = unit.z
      if (dragId === unit.id) {
        x = dragWorld.x
        z = dragWorld.z
      } else if (march) {
        x = march.x
        z = march.z
      }

      if (dragId === unit.id && handle.textures.jump) {
        setMotion(handle, 'jump')
      } else if (march?.walking) {
        setMotion(handle, 'walk')
        // Face toward the deploy slot so the walk-on reads left↔right.
        const dx = unit.x - handle.sprite.root.position.x
        const dz = unit.z - handle.sprite.root.position.z
        handle.facing = facingForVelocity(
          Math.abs(dx) + Math.abs(dz) < 0.02 ? (unit.team === 'hero' ? 1 : -1) : dx,
          dz,
          handle.facing,
        )
      } else if (unit.activity.kind === 'moving' && !handle.dead && handle.motion !== 'attack') {
        setMotion(
          handle,
          handle.team === 'hero' && handle.textures.jump ? 'jump' : 'walk',
        )
        handle.facing = facingForVelocity(
          unit.activity.to.q - unit.activity.from.q,
          unit.activity.to.r - unit.activity.from.r,
          handle.facing,
        )
      } else if (
        unit.activity.kind === 'idle' &&
        !handle.dead &&
        handle.motion !== 'attack' &&
        handle.motion !== 'die' &&
        !march?.walking
      ) {
        setMotion(handle, 'idle')
      }

      handle.motionElapsed += simDelta
      if (handle.flash > 0) handle.flash = Math.max(0, handle.flash - delta)

      if (handle.motion === 'attack') {
        const map = handle.textures.attack ?? handle.textures.idle
        const image = map.image as HTMLImageElement | undefined
        const cols = image?.width ? textureColumns(image.width) : 1
        const rows = image?.height ? textureRows(image.height) : 4
        const frame = oneShotFrameIndex(handle.motionElapsed, cols, 0.08)
        if (handle.motionElapsed > cols * 0.08) setMotion(handle, 'idle')
        handle.sprite.setMap(map)
        const uv = frameUv(frame, cols, facingRow(handle.facing), rows)
        map.repeat.set(...uv.repeat)
        map.offset.set(...uv.offset)
      } else if (handle.motion === 'die') {
        const map = handle.textures.die ?? handle.textures.idle
        const image = map.image as HTMLImageElement | undefined
        const cols = image?.width ? textureColumns(image.width) : 1
        const rows = 1
        const frame = oneShotFrameIndex(handle.motionElapsed, cols, 0.1)
        handle.sprite.setMap(map)
        const uv = frameUv(frame, cols, 0, rows)
        map.repeat.set(...uv.repeat)
        map.offset.set(...uv.offset)
        if (handle.motionElapsed > cols * 0.1 + 0.15) {
          handle.motion = 'dead'
          handle.sprite.root.visible = false
        }
      } else if (handle.motion === 'dead') {
        handle.sprite.root.visible = false
      } else {
        const map =
          handle.motion === 'jump'
            ? handle.textures.jump ?? handle.textures.walk
            : handle.motion === 'walk'
              ? handle.textures.walk
              : handle.textures.idle
        const image = map.image as HTMLImageElement | undefined
        const cols = image?.width ? textureColumns(image.width) : 1
        const rows = image?.height ? textureRows(image.height) : 4
        const frameSeconds =
          handle.motion === 'jump' ? 0.08 : handle.motion === 'walk' ? 0.12 : 0.2
        const frame = Math.floor(handle.motionElapsed / frameSeconds) % cols
        handle.sprite.setMap(map)
        const uv = frameUv(frame, cols, facingRow(handle.facing), rows)
        map.repeat.set(...uv.repeat)
        map.offset.set(...uv.offset)
        handle.sprite.root.visible = unit.alive
      }

      const activity = unit.activity
      if (activity.kind === 'attacking' && !march && dragId !== unit.id) {
        const target = handles.find((candidate) => candidate.id === activity.targetId)
        if (target) {
          const dx = target.sprite.root.position.x - x
          const dz = target.sprite.root.position.z - z
          const length = Math.hypot(dx, dz) || 1
          const pulse = Math.sin(Math.min(1, activity.elapsed / 0.2) * Math.PI)
          x += (dx / length) * pulse * 0.16
          z += (dz / length) * pulse * 0.16
        }
      }

      let footY = battleGroundY(x, z)
      if (handle.team === 'hero' && activity.kind === 'moving') {
        const progress = Math.min(1, activity.t / Math.max(0.001, activity.duration))
        footY += Math.sin(progress * Math.PI) * 0.3
      } else if (dragId === unit.id) {
        footY += 0.16
      }
      handle.sprite.plant(x, z, footY)
      handle.sprite.faceCamera(camera.current)
      const tint = handle.flash > 0 ? hitTint : $dusk ? duskTint : dayTint
      handle.sprite.material.color.copy(tint)
      handle.sprite.material.opacity = actorOpacity
      handle.sprite.outlineMaterial.opacity = actorOpacity
      handle.sprite.mesh.castShadow = actorOpacity > 0.24

      if (unit.alive && handle.motion !== 'dead') {
        const projected = projectHead(x, z, handle.sprite)
        vitals.push({
          id: unit.id,
          name: unit.name,
          team: unit.team,
          hp: unit.hp,
          maxHp: unit.maxHp,
          alive: unit.alive,
          screenX: projected.screenX,
          screenY: projected.screenY,
          onScreen: projected.onScreen,
        })
      }
    }

    for (const projectile of projectiles) {
      projectile.age += simDelta
      const progress = Math.min(1, projectile.age / projectile.duration)
      projectile.mesh.position.lerpVectors(projectile.from, projectile.to, progress)
      projectile.mesh.position.y += Math.sin(progress * Math.PI) * 0.45
    }
    projectiles = projectiles.filter((projectile) => projectile.age < projectile.duration)

    const damage: BattleDamage[] = []
    for (const pop of damagePops) {
      pop.age += delta
      const target = handles.find((handle) => handle.id === pop.targetId)
      if (!target) continue
      const projected = projectHead(
        target.sprite.root.position.x,
        target.sprite.root.position.z,
        target.sprite,
      )
      damage.push({
        id: pop.id,
        amount: pop.amount,
        defeated: pop.defeated,
        screenX: projected.screenX,
        screenY: projected.screenY - pop.age * 0.055,
        age: pop.age,
      })
    }
    damagePops = damagePops.filter((pop) => pop.age < 0.9)
    publishBattleDamage(damage)

    // Nameplates after march begins; full opacity once formation-ready.
    const showVitals =
      shouldShowBattleUnitVitals() &&
      (!$battleHud.entering || $battleHud.stageBlend > 0.45)
    publishBattleVitals(showVitals ? vitals : [])
  })
</script>

{#each handles as handle (handle.id)}
  <T is={handle.sprite.root} />
{/each}

{#each projectiles as projectile (projectile.id)}
  <T is={projectile.mesh} />
{/each}
