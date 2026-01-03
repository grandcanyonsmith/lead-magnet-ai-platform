import { Page, Locator } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly signUpLink: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('input[name="email"]')
    this.passwordInput = page.locator('input[name="password"]')
    this.submitButton = page.locator('button[type="submit"]')
    // Next.js injects a route announcer with role="alert" that can collide with app alerts in strict mode.
    this.errorMessage = page.locator('[role="alert"]:not(#__next-route-announcer__)')
    this.signUpLink = page.locator('a[href="/auth/signup"]')
  }

  async goto() {
    await this.page.goto('/auth/login')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async waitForLoginSuccess() {
    await this.page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 10000 })
  }

  async waitForError() {
    await this.errorMessage.waitFor({ timeout: 5000 })
  }
}
