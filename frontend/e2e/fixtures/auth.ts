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
      // Ensure page is stable - wait for load state
      await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
      
      // Wait for sidebar to be visible (ensures layout is loaded)
      const sidebar = page.locator('aside');
      try {
        await sidebar.waitFor({ state: 'visible', timeout: 15000 });
      } catch {
        // If sidebar not found, wait a bit more for page to fully render
        await page.waitForTimeout(2000);
      }

      // Try getByRole first (most reliable)
      let userMenu = page.getByRole('button', { name: /user menu/i });
      const roleCount = await userMenu.count();
      
      if (roleCount === 0) {
        // Fallback to aria-label selector
        userMenu = page.locator('[aria-label="User menu"]').first();
      }
      
      // Wait for user menu to be visible
      await userMenu.waitFor({ state: 'visible', timeout: 15000 });
      await userMenu.click();
      
      // Wait for dropdown menu to appear before clicking logout
      // Try menuitem role first, then fallback to text locator
      let logoutButton = page.getByRole('menuitem', { name: /log\s*out|sign\s*out/i });
      if (await logoutButton.count() === 0) {
        logoutButton = page.locator('text=/sign\\s*out|log\\s*out|logout/i');
      }
      await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
      await logoutButton.click();
      
      // Wait for navigation to login page with longer timeout
      await page.waitForURL(/\/auth\/login/, { timeout: 10000 })
    })
  },
})

export { expect } from '@playwright/test'
