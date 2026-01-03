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
    
    // New workflow flow starts with a choice screen (not a <form/>).
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /How would you like to start/i
    )
    await expect(page.getByRole('button', { name: /Generate with AI/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Start from Scratch/i })).toBeVisible()
  })

  test('should display workflows list', async ({ page }) => {
    await page.goto('/dashboard/workflows')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Page can show a table (when workflows exist) or an empty state.
    const workflowsTable = page.locator('table')
    const emptyState = page.getByRole('heading', {
      name: /No lead magnets yet|No matching lead magnets/i,
    })

    await expect(async () => {
      const tableVisible =
        (await workflowsTable.count()) > 0 &&
        (await workflowsTable.first().isVisible().catch(() => false))
      const emptyVisible =
        (await emptyState.count()) > 0 &&
        (await emptyState.first().isVisible().catch(() => false))

      expect(tableVisible || emptyVisible).toBeTruthy()
    }).toPass({ timeout: 10000 })
  })
})
