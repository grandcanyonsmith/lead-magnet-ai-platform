import { Page, Locator } from '@playwright/test'

export class DashboardPage {
  readonly page: Page
  readonly heading: Locator
  readonly createLeadMagnetButton: Locator
  readonly statsCards: Locator
  readonly sidebar: Locator
  readonly workflowsLink: Locator
  readonly jobsLink: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.locator('h1:has-text("Dashboard")')
    this.createLeadMagnetButton = page.locator('a[href="/dashboard/workflows/new"]')
    this.statsCards = page.locator('[class*="bg-white"]').filter({ hasText: /Lead Magnets|Completed|Failed|Pending|Success Rate|Processing Time/ })
    this.sidebar = page.locator('aside')
    this.workflowsLink = page.locator('a[href="/dashboard/workflows"]')
    this.jobsLink = page.locator('a[href="/dashboard/jobs"]')
  }

  async goto() {
    await this.page.goto('/dashboard')
    await this.heading.waitFor({ timeout: 10000 })
  }

  async navigateToWorkflows() {
    await this.workflowsLink.click()
    await this.page.waitForURL('/dashboard/workflows', { timeout: 5000 })
  }

  async navigateToJobs() {
    await this.jobsLink.click()
    await this.page.waitForURL('/dashboard/jobs', { timeout: 5000 })
  }

  async clickCreateLeadMagnet() {
    await this.createLeadMagnetButton.click()
    await this.page.waitForURL('/dashboard/workflows/new', { timeout: 5000 })
  }
}
