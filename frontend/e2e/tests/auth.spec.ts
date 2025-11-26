import { test, expect } from '../fixtures/auth'
import { LoginPage } from '../pages/LoginPage'

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
    await expect(loginPage.errorMessage).toContainText(/error|failed|invalid/i)
  })

  test('should login successfully with valid credentials', async ({ page, login }) => {
    await login()
    
    // Should redirect to dashboard or onboarding
    await expect(page).toHaveURL(/\/dashboard|\/onboarding/)
  })

  test('should logout successfully', async ({ page, login, logout }) => {
    await login()
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    
    await logout()
    
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('should navigate to signup page', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    await loginPage.signUpLink.click()
    await expect(page).toHaveURL('/auth/signup')
  })
})
