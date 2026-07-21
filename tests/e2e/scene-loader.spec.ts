import { expect, test } from '@playwright/test'

test('keeps the loading screen up until scene assets finish', async ({ page }) => {
  let releaseGrass = () => {}
  const grassGate = new Promise<void>((resolve) => {
    releaseGrass = resolve
  })

  await page.route('**/grass.glb', async (route) => {
    await grassGate
    await route.continue()
  })

  const grassRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname.endsWith('/grass.glb'),
  )
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await grassRequest

  const loader = page.getByTestId('scene-loader')
  await expect(loader).toBeVisible()
  await expect(page.getByRole('progressbar', { name: /scene loading progress/i })).toBeVisible()
  await page.screenshot({ path: 'test-results/scene-loader.png' })

  releaseGrass()
  await expect(loader).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Amber Marches/i })).toBeVisible()
})
