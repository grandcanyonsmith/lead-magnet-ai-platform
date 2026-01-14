import { test, expect } from '../fixtures/auth'
import { DashboardPage } from '../pages/DashboardPage'

test.describe('Dashboard', () => {
  test('should display dashboard page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    await expect(dashboardPage.heading).toBeVisible()
    await expect(dashboardPage.createLeadMagnetButton).toBeVisible()
  })

  test('should display stats cards', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    await expect(page.getByText('Leads Collected')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Reports Generated')).toBeVisible()
    await expect(page.getByText('Active Magnets')).toBeVisible()
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
    // Wait for the jobs page to be fully loaded
    await expect(page).toHaveURL('/dashboard/jobs', { timeout: 10000 })
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to create workflow page', async ({ page }) => {
    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    
    await dashboardPage.clickCreateLeadMagnet()
    // Wait for the new workflow page to be fully loaded
    await expect(page).toHaveURL('/dashboard/workflows/new', { timeout: 10000 })
    // Verify the choice screen appears
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /How would you like to start/i,
      { timeout: 10000 }
    )
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
