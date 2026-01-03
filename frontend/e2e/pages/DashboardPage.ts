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
    // The dashboard title is a dynamic greeting ("Good morning, ..."), so wait on stable UI instead.
    this.heading = page.getByRole('heading', { level: 1 })
    this.createLeadMagnetButton = page.locator(
      'a[href="/dashboard/workflows/new"]:has-text("Create Lead Magnet")'
    )
    this.statsCards = page.locator(
      'text=/Leads Collected|Reports Generated|Active Magnets/'
    )
    this.sidebar = page.locator('aside')
    // Sidebar links are the most stable/unique targets (dashboard page also has quick-action links).
    this.workflowsLink = page.locator(
      'aside a[href="/dashboard/workflows"]:has-text("Lead Magnets")'
    )
    this.jobsLink = page.locator(
      'aside a[href="/dashboard/jobs"]:has-text("Leads & Results")'
    )
  }

  async goto() {
    await this.page.goto('/dashboard')
    await this.createLeadMagnetButton.waitFor({ timeout: 10000 })
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
