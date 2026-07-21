<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core'
  import {
    Color,
    NearestFilter,
    SRGBColorSpace,
    TextureLoader,
    Vector3,
    type Texture,
  } from 'three'
  import {
    combatImpact,
    combatFocus,
    createSwingResolver,
    damageEvents,
    getAttackSwings,
    nextDamageId,
    PASSIVE_ENEMIES,
    clearCombatHudVitals,
    publishCombatHud,
    pushCombatImpact,
    pushDamageEvents,
    setCombatants,
    tickDamageEvents,
    type Combatant,
    type DamageEvent,
  } from '../combat'
  import type { EnemyDefinition } from '../combat/encounter'
  import { LOOT_DROP_AFTER_DEATH, spawnLootBurst } from '../loot/runtime'
  import { walkHeight } from '../data/amberMarches'
  import { dusk, playerLive, pulseCombat, reducedMotion } from '../worldState'
  import {
    isBattleActive,
    isBattleActorsHidden,
    isEncounterCleared,
    shouldShowOverworldEnemyVitals,
  } from '../battle'
  import {
    FRAME_HEIGHT,
    facingForVelocity,
    facingRow,
    frameUv,
    oneShotFrameIndex,
    textureColumns,
    textureRows,
  } from './spriteSheet'
  import { createPseudo3DSprite, type Pseudo3DSprite } from './pseudo3dSprite'

  type EnemyMotion = 'idle' | 'dmg' | 'die' | 'dead'
  type EnemyHandle = {
    definition: EnemyDefinition
    combatant: Combatant
    sprite: Pseudo3DSprite
    textures: Record<'idle' | 'walk' | 'dmg' | 'die', Texture>
    motion: EnemyMotion
    motionElapsed: number
    flash: number
    recoil: number
    recoilX: number
    recoilZ: number
    /** True once the corpse has been cleared and loot spilled. */
    remainsCleared: boolean
  }

  const CARD_ASPECT = 0.72
  const FEET_FROM_TOP = 20
  const IDLE_FRAME_SECONDS = 0.2
  const REACTION_FRAME_SECONDS = 0.1
  const loader = new TextureLoader()
  const dayTint = new Color('#eee4d2')
  const duskTint = new Color('#c6a1b0')
  const hitTint = new Color('#fff2bc')
  const projection = new Vector3()
  const resolver = createSwingResolver()
  let resetSerial = combatImpact.resetSerial

  const { camera, canvas } = useThrelte()

  function loadTexture(url: string) {
    const texture = loader.load(url)
    texture.magFilter = NearestFilter
    texture.minFilter = NearestFilter
    texture.generateMipmaps = false
    texture.colorSpace = SRGBColorSpace
    return texture
  }

  function createEnemy(definition: EnemyDefinition): EnemyHandle {
    const textures = {
      idle: loadTexture(definition.assets.idle),
      walk: loadTexture(definition.assets.walk),
      dmg: loadTexture(definition.assets.dmg),
      die: loadTexture(definition.assets.die),
    }
    const sprite = createPseudo3DSprite({
      map: textures.idle,
      height: definition.cardHeight,
      width: definition.cardHeight * CARD_ASPECT,
      radius: definition.radius,
      bodyBaseY:
        -((FRAME_HEIGHT - FEET_FROM_TOP) / FRAME_HEIGHT) * definition.cardHeight,
    })
    sprite.root.userData.id = definition.id
    sprite.root.userData.enemy = true
    sprite.plant(definition.x, definition.z, walkHeight(definition.x, definition.z))

    return {
      definition,
      combatant: {
        id: definition.id,
        faction: 'enemy',
        x: definition.x,
        z: definition.z,
        radius: definition.radius,
        health: definition.maxHealth,
        maxHealth: definition.maxHealth,
        alive: true,
      },
      sprite,
      textures,
      motion: 'idle',
      motionElapsed: 0,
      flash: 0,
      recoil: 0,
      recoilX: 0,
      recoilZ: 0,
      remainsCleared: false,
    }
  }

  function clearRemains(enemy: EnemyHandle) {
    if (enemy.remainsCleared) return
    enemy.remainsCleared = true
    enemy.sprite.root.visible = false
    spawnLootBurst(enemy.combatant.x, enemy.combatant.z, enemy.combatant.id)
  }

  const enemies = PASSIVE_ENEMIES.map(createEnemy)
  const combatants = enemies.map((enemy) => enemy.combatant)
  setCombatants(combatants)

  function frameFor(enemy: EnemyHandle, columns: number) {
    if (columns <= 1) return 0
    const seconds =
      enemy.motion === 'idle'
        ? IDLE_FRAME_SECONDS
        : enemy.motion === 'die'
          ? enemy.definition.deathFrameSeconds
          : REACTION_FRAME_SECONDS
    const frame = Math.floor(enemy.motionElapsed / seconds)
    return enemy.motion === 'idle'
      ? frame % columns
      : oneShotFrameIndex(enemy.motionElapsed, columns, seconds)
  }

  function setMotion(enemy: EnemyHandle, motion: EnemyMotion) {
    if (enemy.motion === motion) return
    enemy.motion = motion
    enemy.motionElapsed = 0
  }

  function reactToDamage(event: DamageEvent) {
    const enemy = enemies.find((candidate) => candidate.combatant.id === event.targetId)
    if (!enemy) return
    enemy.flash = 0.13
    enemy.recoil = $reducedMotion ? 0.04 : 0.28
    const dx = enemy.combatant.x - playerLive.x
    const dz = enemy.combatant.z - playerLive.z
    const length = Math.hypot(dx, dz) || 1
    enemy.recoilX = dx / length
    enemy.recoilZ = dz / length
    setMotion(enemy, event.defeated ? 'die' : 'dmg')
  }

  function resetEnemies() {
    resolver.reset()
    for (const enemy of enemies) {
      enemy.combatant.health = enemy.combatant.maxHealth
      enemy.combatant.alive = true
      enemy.flash = 0
      enemy.recoil = 0
      enemy.remainsCleared = false
      setMotion(enemy, 'idle')
      enemy.sprite.root.visible = true
    }
  }

  function projectWorld(x: number, y: number, z: number) {
    projection.set(x, y, z).project(camera.current)
    return {
      x: projection.x * 0.5 + 0.5,
      y: -projection.y * 0.5 + 0.5,
      visible:
        projection.z > -1 &&
        projection.z < 1 &&
        Math.abs(projection.x) < 1.15 &&
        Math.abs(projection.y) < 1.15,
    }
  }

  /** World-space top of the billboard card after plant / bob / squash. */
  function cardTopY(
    groundY: number,
    sprite: Pseudo3DSprite,
    bob: number,
    squash: number,
  ) {
    return groundY + sprite.bodyBaseY + bob + sprite.height * squash
  }

  useTask((delta) => {
    if (combatImpact.resetSerial !== resetSerial) {
      resetSerial = combatImpact.resetSerial
      resetEnemies()
    }

    // Hex battle owns this pack after prelude handoff; stay hidden through soft exit / clear.
    // Always clear overworld vitals when the explore publisher does not own the field —
    // otherwise CombatOverlay remounts on idle with a stale pre-battle snapshot.
    if (!shouldShowOverworldEnemyVitals()) {
      clearCombatHudVitals()
      if (isEncounterCleared()) {
        for (const enemy of enemies) {
          enemy.sprite.root.visible = false
          enemy.combatant.alive = false
          enemy.combatant.health = 0
        }
        setCombatants(combatants)
        return
      }
      if (isBattleActorsHidden()) {
        for (const enemy of enemies) enemy.sprite.root.visible = false
        return
      }
      // Prelude: freeze world pack in place while the stage settles in.
      if (isBattleActive()) {
        for (const enemy of enemies) {
          if (!enemy.remainsCleared) {
            enemy.sprite.root.visible = true
            enemy.sprite.faceCamera(camera.current)
          }
        }
      }
      return
    }

    for (const enemy of enemies) {
      if (!enemy.remainsCleared) enemy.sprite.root.visible = true
    }

    tickDamageEvents(delta)
    for (const swing of getAttackSwings()) {
      const events = resolver.resolve(swing, combatants, nextDamageId)
      if (!events.length) continue

      let impactX = 0
      let impactZ = 0
      for (const event of events) {
        const enemy = enemies.find((candidate) => candidate.combatant.id === event.targetId)
        if (!enemy) continue
        event.y =
          walkHeight(enemy.combatant.x, enemy.combatant.z) +
          enemy.definition.cardHeight * 0.72
        reactToDamage(event)
        impactX += event.x
        impactZ += event.z
      }
      pushDamageEvents(events)
      pushCombatImpact(
        impactX / events.length,
        impactZ / events.length,
        Math.min(1.35, 0.85 + events.length * 0.16),
      )
      pulseCombat()
    }

    for (const enemy of enemies) {
      enemy.motionElapsed += delta
      enemy.flash = Math.max(0, enemy.flash - delta)
      enemy.recoil *= Math.pow(0.0015, delta)

      const textureMotion =
        enemy.motion === 'dead' ? 'die' : enemy.motion === 'die' ? 'die' : enemy.motion
      const texture = enemy.textures[textureMotion]
      enemy.sprite.setMap(texture)
      const image = texture.image as HTMLImageElement | undefined
      const columns = image?.width ? textureColumns(image.width) : 1
      const rows = enemy.motion === 'die' || enemy.motion === 'dead'
        ? 1
        : image?.height
          ? textureRows(image.height)
          : 4
      const facing = facingForVelocity(
        playerLive.x - enemy.combatant.x,
        playerLive.z - enemy.combatant.z,
        'front-left',
      )
      const row = rows === 1 ? 0 : facingRow(facing)
      const frame = enemy.motion === 'dead'
        ? columns - 1
        : frameFor(enemy, columns)
      const uv = frameUv(frame, columns, row, rows)
      texture.repeat.set(...uv.repeat)
      texture.offset.set(...uv.offset)

      if (enemy.motion === 'dmg' && enemy.motionElapsed >= columns * REACTION_FRAME_SECONDS) {
        setMotion(enemy, 'idle')
      } else if (enemy.motion === 'die') {
        if (enemy.motionElapsed >= LOOT_DROP_AFTER_DEATH) {
          clearRemains(enemy)
        }
        if (enemy.motionElapsed >= columns * enemy.definition.deathFrameSeconds) {
          setMotion(enemy, 'dead')
          clearRemains(enemy)
        }
      } else if (enemy.motion === 'dead') {
        clearRemains(enemy)
      }

      const ground = walkHeight(enemy.combatant.x, enemy.combatant.z)
      enemy.sprite.plant(
        enemy.combatant.x + enemy.recoilX * enemy.recoil,
        enemy.combatant.z + enemy.recoilZ * enemy.recoil,
        ground,
      )
      const squash = $reducedMotion ? 1 : 1 + Math.min(0.09, enemy.recoil * 0.28)
      enemy.sprite.body.scale.set(1 / squash, squash, 1)
      const idleBob =
        enemy.motion === 'idle' && !$reducedMotion
          ? Math.sin(enemy.motionElapsed * 3.1 + enemy.definition.x) * 0.018
          : 0
      enemy.sprite.setBob(idleBob)
      enemy.sprite.faceCamera(camera.current)
      const tint = enemy.flash > 0 ? hitTint : $dusk ? duskTint : dayTint
      enemy.sprite.material.color.lerp(tint, 1 - Math.pow(0.0005, delta))
    }

    for (const event of damageEvents) {
      const projected = projectWorld(event.x, event.y, event.z)
      event.screenX = projected.x
      event.screenY = projected.y
      event.onScreen = projected.visible
    }

    if (canvas.clientWidth > 0) {
      // WorldCamera just wrote position/lookAt; refresh matrices before project
      // so plates track the same transform the renderer will use this frame.
      camera.current.updateMatrixWorld()
      publishCombatHud(
        enemies.map((enemy) => {
          const ground = walkHeight(enemy.combatant.x, enemy.combatant.z)
          const plantedX = enemy.combatant.x + enemy.recoilX * enemy.recoil
          const plantedZ = enemy.combatant.z + enemy.recoilZ * enemy.recoil
          const squash = $reducedMotion ? 1 : 1 + Math.min(0.09, enemy.recoil * 0.28)
          const idleBob =
            enemy.motion === 'idle' && !$reducedMotion
              ? Math.sin(enemy.motionElapsed * 3.1 + enemy.definition.x) * 0.018
              : 0
          const projected = projectWorld(
            plantedX,
            cardTopY(ground, enemy.sprite, idleBob, squash),
            plantedZ,
          )
          return {
            id: enemy.combatant.id,
            name: enemy.definition.name,
            health: enemy.combatant.health,
            maxHealth: enemy.combatant.maxHealth,
            alive: enemy.combatant.alive,
            screenX:
              projected.x + enemy.definition.hudOffset[0] / canvas.clientWidth,
            screenY:
              projected.y + enemy.definition.hudOffset[1] / canvas.clientHeight,
            onScreen: projected.visible,
            focused: combatFocus.targetId === enemy.combatant.id,
          }
        }),
      )
    }
  })
</script>

{#each enemies as enemy (enemy.combatant.id)}
  <T is={enemy.sprite.root} />
{/each}
