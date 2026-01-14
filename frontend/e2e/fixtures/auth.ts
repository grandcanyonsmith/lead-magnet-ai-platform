import { test as base } from '@playwright/test'

export interface AuthFixtures {
  login: (email?: string, password?: string) => Promise<void>
  logout: () => Promise<void>
}

export const test = base.extend<AuthFixtures>({
  login: async ({ page }, use) => {
    await use(async (email = 'test@example.com', password = 'TestPass123!') => {
      await page.goto('/auth/login')

      const emailInput = page.locator('input[name="email"]')
      const passwordInput = page.locator('input[name="password"]')

      // Next.js dev server can occasionally return a transient 404 during a full reload;
      // retry once to keep e2e runs stable (especially on CI).
      try {
        await emailInput.waitFor({ timeout: 10000 })
      } catch {
        await page.goto('/auth/login')
        await emailInput.waitFor({ timeout: 10000 })
      }

      await emailInput.fill(email)
      await passwordInput.fill(password)
      await page.click('button[type="submit"]')
      // Wait for navigation after login
      await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 10000 })
    })
  },

  logout: async ({ page }, use) => {
    await use(async () => {
      // Ensure page is stable - wait for load state instead of networkidle
      try {
        await page.waitForLoadState('load', { timeout: 5000 });
      } catch (e) {
        // Ignore timeout, proceed
      }

      // Wait for user menu directly - it should be visible once the page loads
      // The user menu button has aria-label="User menu" in the Sidebar component
      // Try to wait for sidebar first, but if it fails, wait for user menu directly
      const sidebar = page.locator('aside');
      const userMenu = page.locator('[aria-label="User menu"]').first();
      
      try {
        // First try waiting for sidebar (more reliable)
        await sidebar.waitFor({ state: 'visible', timeout: 10000 });
        await userMenu.waitFor({ state: 'visible', timeout: 5000 });
      } catch (e) {
        // If sidebar wait fails, wait for user menu directly (might be in mobile view)
        await userMenu.waitFor({ state: 'visible', timeout: 15000 });
      }
      
      await userMenu.click();
      
      // Wait for dropdown menu to appear before clicking logout
      const logoutButton = page.locator('text=/sign\\s*out|log\\s*out|logout/i')
      await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
      await logoutButton.click();
      
      // Wait for navigation to login page with longer timeout
      await page.waitForURL(/\/auth\/login/, { timeout: 10000 })
    })
  },
})

export { expect } from '@playwright/test'
