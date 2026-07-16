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

  const speakButton = page.getByRole('button', { name: /Speak The Bellkeeper/i })
  await expect(speakButton).toBeVisible({ timeout: 5000 })
  await speakButton.click()
  // Camera frames the speaker before the bubble appears.
  await expect(page.getByTestId('dialogue-box')).toBeVisible({ timeout: 4000 })
  await expect(page.getByRole('heading', { name: /Mara the Bellkeeper/i })).toBeVisible()
  await page.waitForTimeout(650)
  await page.screenshot({ path: 'test-results/village-discovery.png' })

  // Finish the typewriter, then advance through remaining lines.
  await page.keyboard.press('e')
  await page.keyboard.press('e')
  await page.keyboard.press('e')
  await page.keyboard.press('e')
  await expect(page.getByRole('heading', { name: 'The Bellkeeper' })).toBeVisible({ timeout: 3000 })

  expect(pageErrors).toEqual([])
})

test('the HUD remains legible in a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 760 })
  await page.goto('/')
  await page.waitForTimeout(1800)
  await expect(page.getByRole('button', { name: /Enter the vale/i })).toBeVisible()
  await page.screenshot({ path: 'test-results/narrow-vista.png' })
})

test('the Silverrun bridge and shallow ford remain playable', async ({ page }) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/?art=bridge')
  await page.getByRole('button', { name: /Enter the vale/i }).click()
  await expect(page.getByRole('button', { name: /Take in the view/i })).toBeVisible()
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'test-results/silverrun-bridge.png' })

  // Walk toward one abutment and back across the crowned deck.
  await page.keyboard.down('w')
  await page.waitForTimeout(700)
  await page.keyboard.up('w')
  await page.keyboard.down('s')
  await page.waitForTimeout(1400)
  await page.keyboard.up('s')

  // The dedicated art start exercises wading and its disturbance effects.
  await page.goto('/?art=ford')
  await page.getByRole('button', { name: /Enter the vale/i }).click()
  await page.keyboard.down('a')
  await page.waitForTimeout(600)
  await page.keyboard.up('a')
  await page.waitForTimeout(450)
  await page.screenshot({ path: 'test-results/silverrun-ford.png' })

  expect(pageErrors).toEqual([])
})

test('mobile graphics tier reports live FPS after entering the vale', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
  })
  const page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')
  const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)
  expect(coarse).toBe(true)

  await page.getByRole('button', { name: /Enter the vale/i }).click()
  await expect(page.getByTestId('perf-panel')).toBeVisible({ timeout: 5000 })
  // Wait for perfStats publish window (~0.28s) plus a few composer frames.
  await page.waitForTimeout(1200)

  const fpsText = await page.getByTestId('perf-fps').locator('strong').innerText()
  const fps = Number(fpsText)
  expect(Number.isFinite(fps)).toBe(true)
  expect(fps).toBeGreaterThan(0)
  expect(pageErrors).toEqual([])

  await context.close()
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

test('procedural ascent and mountain summit render without asset failures', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/?art=ascent')
  await page.getByRole('button', { name: /Enter the vale/i }).click()
  await page.waitForTimeout(1800)

  await expect(page.getByTestId('world-canvas')).toBeVisible()
  await page.screenshot({ path: 'test-results/whispering-ascent.png' })
  expect(pageErrors).toEqual([])
})
