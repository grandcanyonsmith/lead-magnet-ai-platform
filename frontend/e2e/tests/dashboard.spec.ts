import { test, expect } from '../fixtures/auth'
import { DashboardPage } from '../pages/DashboardPage'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ login }) => {
    await login()
  })

  test('should display dashboard page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    await expect(dashboardPage.heading).toBeVisible()
    await expect(dashboardPage.heading).toContainText('Dashboard')
  })

  test('should display stats cards', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Wait for stats to load
    await page.waitForSelector('[class*="bg-white"]', { timeout: 10000 })
    
    // Check that stats cards are visible
    const statsCount = await dashboardPage.statsCards.count()
    expect(statsCount).toBeGreaterThan(0)
  })

  test('should navigate to workflows page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    await dashboardPage.navigateToWorkflows()
    await expect(page).toHaveURL('/dashboard/workflows')
  })

  test('should navigate to jobs page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    await dashboardPage.navigateToJobs()
    await expect(page).toHaveURL('/dashboard/jobs')
  })

  test('should navigate to create workflow page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    await dashboardPage.clickCreateLeadMagnet()
    await expect(page).toHaveURL('/dashboard/workflows/new')
  })

  test('should have accessible navigation', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    // Check sidebar is visible
    await expect(dashboardPage.sidebar).toBeVisible()
    
    // Check navigation links have proper labels
    const workflowsLink = dashboardPage.workflowsLink
    await expect(workflowsLink).toBeVisible()
    
    // Test keyboard navigation
    await workflowsLink.focus()
    await expect(workflowsLink).toBeFocused()
  })
})
