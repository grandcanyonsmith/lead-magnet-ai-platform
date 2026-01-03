import { test, expect } from '../fixtures/auth'

test.describe('Forms and Jobs', () => {

  test('should navigate to jobs page', async ({ page }) => {
    await page.goto('/dashboard/jobs')
    
    await expect(page).toHaveURL('/dashboard/jobs')
    
    // Check page loads
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to artifacts page', async ({ page }) => {
    await page.goto('/dashboard/artifacts')
    
    await expect(page).toHaveURL('/dashboard/artifacts')
    
    // Check page loads
    const content = page.locator('main, [role="main"]')
    await expect(content.first()).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/dashboard/settings')
    
    await expect(page).toHaveURL('/dashboard/settings')
    
    // Check settings form or content is visible
    const settingsContent = page.locator('form, [class*="settings"], main')
    await expect(settingsContent.first()).toBeVisible({ timeout: 10000 })
  })

  test('should have accessible forms', async ({ page }) => {
    await page.goto('/dashboard/settings')
    
    // Check form inputs have labels
    const inputs = page.locator('input[type="text"], input[type="email"], textarea')
    // Wait for at least one input if expected, or just proceed. 
    // If settings page loads dynamically, we might need to wait for something.
    // The previous test waited for settingsContent, let's wait for that here too.
    await page.locator('form, [class*="settings"], main').first().waitFor();
    
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
