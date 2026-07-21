import { describe, expect, it, vi } from 'vitest'
import { LoadingManager } from 'three'
import { createSceneLoadingStore, type SceneLoadingState } from './sceneLoading'

describe('sceneLoading', () => {
  it('tracks completed and failed assets through a Three loading manager', () => {
    const manager = new LoadingManager()
    const states: SceneLoadingState[] = []
    const unsubscribe = createSceneLoadingStore(manager).subscribe((state) => {
      states.push(state)
    })

    manager.itemStart('/terrain.glb')
    manager.itemStart('/party.png')
    manager.itemEnd('/terrain.glb')

    expect(states.at(-1)).toMatchObject({
      active: true,
      loaded: 1,
      total: 2,
      progress: 0.5,
    })

    manager.itemError('/party.png')
    manager.itemEnd('/party.png')

    expect(states.at(-1)).toEqual({
      active: false,
      loaded: 2,
      total: 2,
      progress: 1,
      failed: 1,
    })

    unsubscribe()
  })

  it('preserves callbacks installed before the store subscribes', () => {
    const manager = new LoadingManager()
    const previousProgress = vi.fn()
    manager.onProgress = previousProgress

    const unsubscribe = createSceneLoadingStore(manager).subscribe(() => {})
    manager.itemStart('/tree.gltf')
    manager.itemEnd('/tree.gltf')

    expect(previousProgress).toHaveBeenCalledWith('/tree.gltf', 1, 1)
    unsubscribe()
    expect(manager.onProgress).toBe(previousProgress)
  })
})
