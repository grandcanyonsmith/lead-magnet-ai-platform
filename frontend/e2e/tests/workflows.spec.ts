import { test, expect } from '../fixtures/auth'
import { DashboardPage } from '../pages/DashboardPage'

test.describe('Workflows', () => {
  test.beforeEach(async ({ login }) => {
    await login()
  })

  test('should navigate to workflows page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.navigateToWorkflows()
    
    await expect(page).toHaveURL('/dashboard/workflows')
    
    // Check page loads
    await page.waitForLoadState('networkidle')
  })

  test('should navigate to create workflow page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.clickCreateLeadMagnet()
    
    await expect(page).toHaveURL('/dashboard/workflows/new')
    
    // Check form is visible
    const form = page.locator('form, [role="form"]')
    await expect(form.first()).toBeVisible({ timeout: 5000 })
  })

  test('should display workflows list', async ({ page }) => {
    await page.goto('/dashboard/workflows')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check for workflows table or list
    const workflowsList = page.locator('table, [role="table"], [class*="workflow"]')
    await expect(workflowsList.first()).toBeVisible({ timeout: 10000 })
  })
})
