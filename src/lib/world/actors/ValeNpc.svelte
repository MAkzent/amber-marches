<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core'
  import { Color, NearestFilter, SRGBColorSpace, TextureLoader } from 'three'
  import { walkHeight } from '../data/sunmereVale'
  import { dusk } from '../worldState'
  import {
    FRAME_HEIGHT,
    FRAME_WIDTH,
    facingRow,
    frameIndex,
    frameUv,
    textureColumns,
    textureRows,
  } from './spriteSheet'
  import { createPseudo3DSprite } from './pseudo3dSprite'

  const texture = new TextureLoader().load('/assets/minifantasy/heroes/cleric/idle.png')
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = SRGBColorSpace

  const height = 3.9
  const dayTint = new Color('#eee4d2')
  const duskTint = new Color('#c6a1b0')
  const actor = createPseudo3DSprite({
    map: texture,
    height,
    width: height * (FRAME_WIDTH / FRAME_HEIGHT),
    bodyBaseY: -((FRAME_HEIGHT - 19) / FRAME_HEIGHT) * height,
    outlineColor: '#080908',
  })
  actor.outlineMaterial.toneMapped = false
  actor.plant(-7, 9, walkHeight(-7, 9))

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
  })
</script>

<T is={actor.root} />
