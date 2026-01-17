import { Page, Locator } from '@playwright/test'

export class DashboardPage {
  readonly page: Page
  readonly heading: Locator
  readonly createLeadMagnetButton: Locator
  readonly statsCards: Locator
  readonly sidebar: Locator
  readonly sidebarToggle: Locator
  readonly workflowsLink: Locator
  readonly jobsLink: Locator
  readonly mainContent: Locator

  constructor(page: Page) {
    this.page = page
    // The dashboard title is a dynamic greeting ("Good morning, ..."), so wait on stable UI instead.
    this.heading = page.getByRole('heading', { level: 1 })
    // Target the header button specifically - it's in the PageHeader component
    // Use a more specific selector that targets links containing "Create Lead Magnet" text
    // Prefer the one in the header area (has Sparkles icon) over quick actions
    this.createLeadMagnetButton = page
      .locator('a[href="/dashboard/workflows/new"]')
      .filter({ hasText: /create lead magnet/i })
      .first()
    this.statsCards = page.locator(
      'text=/Leads Collected|Reports Generated|Active Magnets/'
    )
    this.sidebar = page.locator('aside')
    this.sidebarToggle = page.getByRole('button', { name: /toggle navigation/i })
    // Sidebar links are the most stable/unique targets (dashboard page also has quick-action links).
    this.workflowsLink = page.locator(
      'aside a[href="/dashboard/workflows"]:has-text("Lead Magnets")'
    )
    this.jobsLink = page.locator(
      'aside a[href="/dashboard/jobs"]:has-text("Leads & Results")'
    )
    // Main content area is more stable than waiting for specific elements
    this.mainContent = page.locator('main')
  }

  async goto() {
    await this.page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    
    // Wait for main content area to be visible (more stable than heading)
    // This ensures the skeleton loader is gone and content is rendered
    await this.mainContent.waitFor({ timeout: 20000, state: 'visible' })
    
    // Wait for sidebar to be visible (indicates layout is loaded)
    await this.sidebar.waitFor({ timeout: 15000, state: 'visible' })
    
    // Wait for the create button to be visible (indicates page content is loaded)
    // Use a more reliable wait that checks for the button's presence
    await this.createLeadMagnetButton.waitFor({ timeout: 15000, state: 'visible' })
    
    // Wait for page to be fully loaded
    await this.page.waitForLoadState('load', { timeout: 10000 }).catch(() => {
      // Ignore timeout - page might already be loaded
    })
  }

  async navigateToWorkflows() {
    await this.openSidebar()
    await this.workflowsLink.scrollIntoViewIfNeeded()
    await this.workflowsLink.click()
    // Use waitForURL with a longer timeout for Next.js client-side routing
    await this.page.waitForURL('/dashboard/workflows', { timeout: 10000 })
  }

  async navigateToJobs() {
    await this.openSidebar()
    await this.jobsLink.scrollIntoViewIfNeeded()
    await this.jobsLink.click()
    // Use waitForURL with a longer timeout for Next.js client-side routing
    await this.page.waitForURL('/dashboard/jobs', { timeout: 10000 })
  }

  async clickCreateLeadMagnet() {
    // Ensure button is visible and enabled before clicking
    await this.createLeadMagnetButton.waitFor({ timeout: 15000, state: 'visible' })
    await this.createLeadMagnetButton.click()
    // Use waitForURL with a longer timeout for Next.js client-side routing
    await this.page.waitForURL('/dashboard/workflows/new', { timeout: 10000 })
  }

  async openSidebar() {
    const expanded = await this.sidebarToggle.getAttribute('aria-expanded')
    if (expanded !== 'true') {
      await this.sidebarToggle.click()
    }
    await this.sidebar.waitFor({ timeout: 10000, state: 'visible' })
  }
}
