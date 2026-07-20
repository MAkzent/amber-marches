import { describe, expect, it } from 'vitest'
import { BoxGeometry, Mesh, MeshBasicMaterial, Sphere, Vector3 } from 'three'
import {
  TREE_FADE_MIN_OPACITY,
  treeActuallyOccludesCharacter,
  treeOcclusionOpacity,
  treeOpacityForDistance,
  type CharacterSightTarget,
} from './treeOcclusion'

const camera = new Vector3(10, 8, 10)
const character: CharacterSightTarget = { x: 0, y: 0, z: 0 }

describe('tree occlusion', () => {
  it('fades a tree that crosses the camera-to-character sight line', () => {
    const tree = new Sphere(new Vector3(2, 3, 2), 1.2)

    expect(treeOcclusionOpacity(camera, tree, character)).toBeLessThan(1)
  })

  it('keeps trees behind the character or away from the sight line opaque', () => {
    const behind = new Sphere(new Vector3(-2, 2, -2), 1.5)
    const offAxis = new Sphere(new Vector3(4, 3.5, -1), 0.6)

    expect(treeOcclusionOpacity(camera, behind, character)).toBe(1)
    expect(treeOcclusionOpacity(camera, offAxis, character)).toBe(1)
  })

  it('gives closer obstructors stronger priority', () => {
    const near = new Sphere(new Vector3(1.2, 2.5, 1.2), 1)
    const far = new Sphere(new Vector3(4, 4.3, 4), 1)

    const nearOpacity = treeOcclusionOpacity(camera, near, character)
    const farOpacity = treeOcclusionOpacity(camera, far, character)

    expect(nearOpacity).toBeCloseTo(TREE_FADE_MIN_OPACITY)
    expect(nearOpacity).toBeLessThan(farOpacity)
    expect(farOpacity).toBeLessThan(1)
  })

  it('does not fade for a companion when the controlled character is clear', () => {
    const tree = new Sphere(new Vector3(2, 3, 2), 1.2)
    const clearCharacter: CharacterSightTarget = { x: -5, y: 0, z: 1 }

    expect(treeOcclusionOpacity(camera, tree, clearCharacter)).toBe(1)
  })

  it('confirms that rendered tree geometry is actually in front of the character', () => {
    const tree = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial())
    tree.position.set(2, 3, 2)
    tree.updateMatrixWorld(true)

    expect(treeActuallyOccludesCharacter(tree, camera, character)).toBe(true)

    tree.position.set(4, 3, -2)
    tree.updateMatrixWorld(true)
    expect(treeActuallyOccludesCharacter(tree, camera, character)).toBe(false)
  })

  it('clamps the distance fade to readable limits', () => {
    expect(treeOpacityForDistance(0)).toBe(TREE_FADE_MIN_OPACITY)
    expect(treeOpacityForDistance(100)).toBe(1)
  })
})
