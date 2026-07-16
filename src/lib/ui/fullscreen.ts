type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

export function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export function isFullscreenActive(): boolean {
  return getFullscreenElement() != null
}

export async function requestAppFullscreen(target: HTMLElement = document.documentElement): Promise<boolean> {
  const element = target as FullscreenElement
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: 'hide' })
      return true
    }
    if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen()
      return true
    }
  } catch {
    return false
  }
  return false
}

export async function exitAppFullscreen(): Promise<boolean> {
  const doc = document as FullscreenDocument
  try {
    if (document.exitFullscreen && document.fullscreenElement) {
      await document.exitFullscreen()
      return true
    }
    if (doc.webkitExitFullscreen && doc.webkitFullscreenElement) {
      await doc.webkitExitFullscreen()
      return true
    }
  } catch {
    return false
  }
  return false
}

export async function toggleAppFullscreen(target?: HTMLElement): Promise<boolean> {
  if (isFullscreenActive()) {
    return exitAppFullscreen()
  }
  return requestAppFullscreen(target ?? document.documentElement)
}

export function subscribeFullscreenChange(listener: () => void): () => void {
  const events = ['fullscreenchange', 'webkitfullscreenchange'] as const
  for (const event of events) {
    document.addEventListener(event, listener)
  }
  return () => {
    for (const event of events) {
      document.removeEventListener(event, listener)
    }
  }
}
