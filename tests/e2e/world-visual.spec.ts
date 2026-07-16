import { devices, expect, test } from '@playwright/test'

test('opening vista renders and the first discovery is playable', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')
  await expect(page.getByTestId('world-canvas')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Sunmere Vale/i })).toBeVisible()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'test-results/opening-vista.png' })

  await page.getByRole('button', { name: /Enter the vale/i }).click()
  await page.keyboard.down('w')
  await page.waitForTimeout(2800)
  await page.keyboard.up('w')

  await expect(page.getByRole('button', { name: /Speak The Bellkeeper/i })).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'The Bellkeeper' })).toBeVisible()
  await page.waitForTimeout(650)
  await page.screenshot({ path: 'test-results/village-discovery.png' })

  expect(pageErrors).toEqual([])
})

test('the HUD remains legible in a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 760 })
  await page.goto('/')
  await page.waitForTimeout(1800)
  await expect(page.getByRole('button', { name: /Enter the vale/i })).toBeVisible()
  await page.screenshot({ path: 'test-results/narrow-vista.png' })
})

test('mobile rotation preserves the canvas and framebuffer proportions', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
  })
  const page = await context.newPage()

  const measureCanvas = () =>
    page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error('World canvas was not mounted')
      }

      const rect = canvas.getBoundingClientRect()
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        cssWidth: rect.width,
        cssHeight: rect.height,
        cssAspect: rect.width / rect.height,
        bufferAspect: canvas.width / canvas.height,
      }
    })

  await page.goto('/')
  await page.waitForTimeout(1200)

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(250)

    const dimensions = await measureCanvas()
    expect(dimensions.cssWidth).toBeCloseTo(dimensions.viewportWidth, 0)
    expect(dimensions.cssHeight).toBeCloseTo(dimensions.viewportHeight, 0)
    expect(dimensions.bufferAspect / dimensions.cssAspect).toBeCloseTo(1, 2)
  }

  await context.close()
})

test('shrine and watchtower art states remain composed through dusk', async ({ page }) => {
  await page.goto('/?art=shrine')
  await page.getByRole('button', { name: /Enter the vale/i }).click()

  await page.waitForTimeout(1700)
  await expect(page.getByRole('button', { name: /Awaken Shrine of Small Mercies/i })).toBeVisible()
  await page.screenshot({ path: 'test-results/forest-shrine.png' })
  await page.keyboard.press('e')

  await page.goto('/?art=watchtower')
  await page.getByRole('button', { name: /Enter the vale/i }).click()
  await page.waitForTimeout(1700)
  await expect(page.getByRole('button', { name: /Raise the banner Larkspur Watch/i })).toBeVisible()
  await page.keyboard.press('e')
  await page.waitForTimeout(1800)
  await page.screenshot({ path: 'test-results/watchtower-dusk.png' })
})
