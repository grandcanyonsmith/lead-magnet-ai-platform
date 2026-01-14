import { test, expect } from '../fixtures/auth'
import { LoginPage } from '../pages/LoginPage'

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('should display login form', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(loginPage.submitButton).toBeVisible()
    await expect(loginPage.signUpLink).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    await loginPage.login('invalid@example.com', 'wrongpassword')
    await loginPage.waitForError()
    
    await expect(loginPage.errorMessage).toBeVisible()
    await expect(loginPage.errorMessage).toContainText(/error|failed|invalid|incorrect/i)
  })

  test('should login successfully with valid credentials', async ({ page, login }) => {
    await login()
    
    // Should redirect to dashboard or onboarding
    await expect(page).toHaveURL(/\/dashboard|\/onboarding/)
  })

  test('should logout successfully', async ({ page, login, logout }) => {
    await login()
    // Wait for dashboard or onboarding page to be fully loaded
    // Login can redirect to either dashboard or onboarding survey
    await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 15000 })
    
    // If we're on onboarding, navigate to dashboard first (onboarding might not have logout)
    const currentUrl = page.url()
    if (currentUrl.includes('/onboarding')) {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
      await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    }
    
    // Wait for main content or sidebar to ensure page is ready
    await Promise.race([
      page.locator('main').waitFor({ state: 'visible', timeout: 10000 }),
      page.locator('aside').waitFor({ state: 'visible', timeout: 10000 })
    ]).catch(() => {
      // Ignore if neither found - proceed anyway
    })
    
    await logout()
    
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })

  test('should navigate to signup page', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    await loginPage.signUpLink.click()
    await expect(page).toHaveURL('/auth/signup')
  })
})
