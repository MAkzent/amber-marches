import { readable, type Readable } from 'svelte/store'
import { DefaultLoadingManager, type LoadingManager } from 'three'

export type SceneLoadingState = {
  active: boolean
  loaded: number
  total: number
  progress: number
  failed: number
}

const initialState: SceneLoadingState = {
  active: true,
  loaded: 0,
  total: 0,
  progress: 0,
  failed: 0,
}

/**
 * Mirrors a Three loading manager as a Svelte store without taking ownership
 * of callbacks that another part of the app may already have installed.
 */
export function createSceneLoadingStore(
  manager: LoadingManager,
): Readable<SceneLoadingState> {
  let state = initialState
  const failedUrls = new Set<string>()

  return readable(state, (set) => {
    const previousStart = manager.onStart
    const previousLoad = manager.onLoad
    const previousProgress = manager.onProgress
    const previousError = manager.onError

    const publish = (next: SceneLoadingState) => {
      state = next
      set(state)
    }

    const handleStart = (url: string, itemsLoaded: number, itemsTotal: number) => {
      previousStart?.(url, itemsLoaded, itemsTotal)
      publish({
        ...state,
        active: true,
        loaded: itemsLoaded,
        total: itemsTotal,
        progress: itemsTotal > 0 ? itemsLoaded / itemsTotal : 0,
      })
    }

    const handleProgress = (url: string, itemsLoaded: number, itemsTotal: number) => {
      previousProgress?.(url, itemsLoaded, itemsTotal)
      publish({
        ...state,
        active: true,
        loaded: itemsLoaded,
        total: itemsTotal,
        progress: itemsTotal > 0 ? itemsLoaded / itemsTotal : 0,
      })
    }

    const handleLoad = () => {
      previousLoad?.()
      publish({
        ...state,
        active: false,
        loaded: state.total,
        progress: 1,
      })
    }

    const handleError = (url: string) => {
      previousError?.(url)
      if (failedUrls.has(url)) return
      failedUrls.add(url)
      publish({
        ...state,
        failed: failedUrls.size,
      })
    }

    manager.onStart = handleStart
    manager.onLoad = handleLoad
    manager.onProgress = handleProgress
    manager.onError = handleError

    return () => {
      if (manager.onStart === handleStart) manager.onStart = previousStart
      if (manager.onLoad === handleLoad) manager.onLoad = previousLoad
      if (manager.onProgress === handleProgress) manager.onProgress = previousProgress
      if (manager.onError === handleError) manager.onError = previousError
    }
  })
}

export const sceneLoading = createSceneLoadingStore(DefaultLoadingManager)
