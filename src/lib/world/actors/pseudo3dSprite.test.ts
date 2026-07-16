import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Texture } from 'three'
import { createPseudo3DSprite } from './pseudo3dSprite'

describe('pseudo-3D sprite actor', () => {
  it('plants the root on the walk surface and keeps bob on the body only', () => {
    const sprite = createPseudo3DSprite({
      map: new Texture(),
      height: 2.5,
      width: 1.8,
      radius: 0.65,
      bodyBaseY: -0.8,
    })

    sprite.plant(3, -4, 1.25)
    expect(sprite.root.position.x).toBe(3)
    expect(sprite.root.position.z).toBe(-4)
    expect(sprite.root.position.y).toBe(1.25)

    sprite.setBob(0.04)
    expect(sprite.body.position.y).toBeCloseTo(-0.76)
    expect(sprite.bodyBaseY).toBe(-0.8)
    expect(sprite.root.position.y).toBe(1.25)
    expect(sprite.mesh.castShadow).toBe(true)
    expect(sprite.root.children).toEqual([sprite.body])
  })

  it('yaws only the body toward the camera (cylindrical billboard)', () => {
    const sprite = createPseudo3DSprite({
      map: new Texture(),
      height: 2.5,
    })
    sprite.plant(0, 0, 0)

    const camera = new PerspectiveCamera()
    camera.position.set(4, 3, 0)
    sprite.faceCamera(camera)

    expect(sprite.root.rotation.y).toBe(0)
    expect(sprite.body.rotation.y).toBeCloseTo(Math.PI / 2, 5)
  })
})
