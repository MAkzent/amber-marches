<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core'
  import {
    Color,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    NearestFilter,
    Shape,
    ShapeGeometry,
    SRGBColorSpace,
    TextureLoader,
  } from 'three'
  import { walkHeight } from '../data/sunmereVale'
  import { activeDialogue, completedDiscoveries, dusk, reducedMotion } from '../worldState'
  import {
    FRAME_HEIGHT,
    facingRow,
    frameIndex,
    frameUv,
    textureColumns,
    textureRows,
  } from './spriteSheet'
  import { createPseudo3DSprite } from './pseudo3dSprite'

  const NPC_X = -7
  const NPC_Z = 9
  const surfaceY = walkHeight(NPC_X, NPC_Z)

  const texture = new TextureLoader().load('/assets/minifantasy/heroes/cleric/idle.png')
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = SRGBColorSpace

  const height = 3.9
  /** Same foreshortening compensation as the party cards. */
  const cardAspect = 0.72
  const dayTint = new Color('#eee4d2')
  const duskTint = new Color('#c6a1b0')
  const actor = createPseudo3DSprite({
    map: texture,
    height,
    width: height * cardAspect,
    bodyBaseY: -((FRAME_HEIGHT - 19) / FRAME_HEIGHT) * height,
    // Cleric sheets already bake a 1px edge — stacking the shader outline reads too heavy.
    outlineOpacity: 0,
  })
  actor.plant(NPC_X, NPC_Z, surfaceY)

  /** Soft house-shaped chevron pointing down — cozy “please talk” marker. */
  function createTalkArrow() {
    const shape = new Shape()
    shape.moveTo(0, -0.52)
    shape.lineTo(0.34, 0.04)
    shape.lineTo(0.15, 0.04)
    shape.lineTo(0.15, 0.42)
    shape.lineTo(-0.15, 0.42)
    shape.lineTo(-0.15, 0.04)
    shape.lineTo(-0.34, 0.04)
    shape.closePath()

    const geometry = new ShapeGeometry(shape)
    const fillMaterial = new MeshBasicMaterial({
      color: '#ffd24a',
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      depthTest: true,
      // Untoned so the chevron stays readable; bloom threshold keeps it from flooding.
      toneMapped: false,
      side: DoubleSide,
    })
    const rimMaterial = new MeshBasicMaterial({
      color: '#d4892a',
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      side: DoubleSide,
    })
    const fill = new Mesh(geometry, fillMaterial)
    const rim = new Mesh(geometry, rimMaterial)
    rim.scale.setScalar(1.18)
    rim.position.z = -0.01
    fill.renderOrder = 6
    rim.renderOrder = 5

    const root = new Group()
    root.add(rim)
    root.add(fill)
    root.position.set(0, height + 0.62, 0)
    root.scale.setScalar(1.15)
    return { root, fillMaterial, rimMaterial }
  }

  const talkArrow = createTalkArrow()
  actor.body.add(talkArrow.root)

  const { camera } = useThrelte()
  let elapsed = 0
  useTask((delta) => {
    elapsed += delta
    const image = texture.image as HTMLImageElement | undefined
    const columns = image?.width ? textureColumns(image.width) : 1
    const rows = image?.height ? textureRows(image.height) : 1
    const uv = frameUv(frameIndex(elapsed, columns, 'idle'), columns, facingRow('front-right'), rows)
    texture.repeat.set(...uv.repeat)
    texture.offset.set(...uv.offset)
    actor.faceCamera(camera.current)
    actor.material.color.lerp($dusk ? duskTint : dayTint, 1 - Math.pow(0.02, delta))

    const showArrow = !$completedDiscoveries.has('villager') && !$activeDialogue
    talkArrow.root.visible = showArrow
    if (!showArrow) return

    if ($reducedMotion) {
      talkArrow.root.position.y = height + 0.62
      talkArrow.fillMaterial.opacity = 0.94
      talkArrow.rimMaterial.opacity = 0.78
      return
    }

    const bob = Math.sin(elapsed * 2.1) * 0.16
    talkArrow.root.position.y = height + 0.62 + bob
    const pulse = 0.9 + Math.sin(elapsed * 2.1 + 0.6) * 0.06
    talkArrow.fillMaterial.opacity = pulse
    talkArrow.rimMaterial.opacity = pulse * 0.82
  })
</script>

<T is={actor.root} />
