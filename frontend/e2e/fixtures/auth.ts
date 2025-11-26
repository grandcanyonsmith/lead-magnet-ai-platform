import { test as base } from '@playwright/test'

export interface AuthFixtures {
  login: (email?: string, password?: string) => Promise<void>
  logout: () => Promise<void>
}

export const test = base.extend<AuthFixtures>({
  login: async ({ page }, use) => {
    await use(async (email = 'test@example.com', password = 'TestPass123!') => {
      await page.goto('/auth/login')
      await page.fill('input[name="email"]', email)
      await page.fill('input[name="password"]', password)
      await page.click('button[type="submit"]')
      // Wait for navigation after login
      await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 10000 })
    })
  },

  logout: async ({ page }, use) => {
    await use(async () => {
      // Click user menu
      await page.click('[aria-label*="user menu" i], [aria-label*="account" i]')
      // Click logout
      await page.click('text=/sign out|logout/i')
      await page.waitForURL(/\/auth\/login/, { timeout: 5000 })
    })
  },
})

export { expect } from '@playwright/test'
