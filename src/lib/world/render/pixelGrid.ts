export interface PixelGrid {
  cellUvX: number
  cellUvY: number
  columns: number
  rows: number
  framebufferPixelSize: number
}

function positiveFinite(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Converts a CSS-pixel effect size into framebuffer and UV space.
 *
 * The same framebufferPixelSize is used on both axes. Therefore:
 *   cellUvX * framebufferWidth === cellUvY * framebufferHeight
 * and every sampled pixel remains square after the canvas is displayed.
 */
export function calculatePixelGrid(
  framebufferWidth: number,
  framebufferHeight: number,
  devicePixelRatio: number,
  cssPixelSize = 2,
): PixelGrid {
  const width = positiveFinite(framebufferWidth, 1)
  const height = positiveFinite(framebufferHeight, 1)
  const pixelRatio = positiveFinite(devicePixelRatio, 1)
  const requestedPixelSize = positiveFinite(cssPixelSize, 1) * pixelRatio
  const framebufferPixelSize = Math.min(requestedPixelSize, width, height)

  return {
    cellUvX: framebufferPixelSize / width,
    cellUvY: framebufferPixelSize / height,
    columns: width / framebufferPixelSize,
    rows: height / framebufferPixelSize,
    framebufferPixelSize,
  }
}
