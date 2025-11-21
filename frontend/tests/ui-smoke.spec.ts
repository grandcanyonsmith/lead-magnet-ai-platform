import { test, expect, Page } from '@playwright/test'

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button:has-text("Sign in")')
  await page.waitForURL('**/dashboard', { timeout: 10_000 })
}

test.describe('UI smoke', () => {
  test('core pages render with new UI and dialogs', async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run UI smoke tests')

    await login(page, email!, password!)

    // Workflows list
    await page.goto('/dashboard/workflows')
    await expect(page.getByRole('heading', { name: /Lead Magnets/i })).toBeVisible()

    // Jobs list
    await page.goto('/dashboard/jobs')
    await expect(page.getByRole('heading', { name: /Generated/i })).toBeVisible()

    // Settings page
    await page.goto('/dashboard/settings')
    // Handle potential slow auth redirect by waiting for either settings or login
    const settingsHeading = page.getByRole('heading', { name: /Settings/i })
    const loginHeading = page.getByRole('heading', { name: /Sign in/i })
    await Promise.race([
      settingsHeading.waitFor({ timeout: 10_000 }),
      loginHeading.waitFor({ timeout: 10_000 }),
    ])
    if (await loginHeading.isVisible()) {
      throw new Error('Redirected to login while opening settings; check credentials/session.')
    }
    await expect(settingsHeading).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: /Save Settings/i })).toBeVisible({ timeout: 5_000 })

    // Files page: ensure delete uses modal if a file exists
    await page.goto('/dashboard/files')
    await expect(page.getByRole('heading', { name: /Files/i })).toBeVisible()
    const deleteButtons = page.locator('div:has-text("Your Files")').locator('button:has-text("Delete")')
    if (await deleteButtons.count()) {
      await deleteButtons.first().click()
      await expect(page.getByRole('heading', { name: /Delete file\?/i })).toBeVisible()
      await page.getByRole('button', { name: /Cancel/i }).click()
    }
  })
})
