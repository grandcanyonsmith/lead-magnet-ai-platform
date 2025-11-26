import { test, expect } from '../fixtures/auth'

test.describe('Forms and Jobs', () => {
  test.beforeEach(async ({ login }) => {
    await login()
  })

  test('should navigate to jobs page', async ({ page }) => {
    await page.goto('/dashboard/jobs')
    
    await expect(page).toHaveURL('/dashboard/jobs')
    await page.waitForLoadState('networkidle')
    
    // Check page loads
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to artifacts page', async ({ page }) => {
    await page.goto('/dashboard/artifacts')
    
    await expect(page).toHaveURL('/dashboard/artifacts')
    await page.waitForLoadState('networkidle')
    
    // Check page loads
    const content = page.locator('main, [role="main"]')
    await expect(content.first()).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/dashboard/settings')
    
    await expect(page).toHaveURL('/dashboard/settings')
    await page.waitForLoadState('networkidle')
    
    // Check settings form or content is visible
    const settingsContent = page.locator('form, [class*="settings"], main')
    await expect(settingsContent.first()).toBeVisible({ timeout: 10000 })
  })

  test('should have accessible forms', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')
    
    // Check form inputs have labels
    const inputs = page.locator('input[type="text"], input[type="email"], textarea')
    const count = await inputs.count()
    
    if (count > 0) {
      const firstInput = inputs.first()
      const id = await firstInput.getAttribute('id')
      const name = await firstInput.getAttribute('name')
      
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        await expect(label).toBeVisible()
      } else if (name) {
        // Check for associated label
        const label = page.locator(`label:has-text("${name}")`)
        const labelCount = await label.count()
        expect(labelCount).toBeGreaterThan(0)
      }
    }
  })
})
