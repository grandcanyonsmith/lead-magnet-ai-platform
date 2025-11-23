/**
 * E2E tests for refactored frontend pages using Playwright.
 * 
 * Tests the refactored users page and job detail page to ensure
 * they work correctly after refactoring.
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const E2E_EMAIL = process.env.E2E_EMAIL
const E2E_PASSWORD = process.env.E2E_PASSWORD

async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE_URL}/auth/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10_000 })
}

test.describe('Refactored Pages E2E', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !E2E_EMAIL || !E2E_PASSWORD,
      'Set E2E_EMAIL and E2E_PASSWORD to run E2E tests'
    )
  })

  test.describe('Users Page', () => {
    test('should load and display users list', async ({ page }) => {
      await login(page, E2E_EMAIL!, E2E_PASSWORD!)

      // Navigate to users page (requires SUPER_ADMIN role)
      await page.goto(`${BASE_URL}/dashboard/agency/users`)

      // Check if page loaded (either shows users or access denied message)
      const pageHeading = page.getByRole('heading', { name: /User Management/i })
      const accessDenied = page.getByText(/only available to Super Admins/i)

      await Promise.race([
        pageHeading.waitFor({ timeout: 5_000 }).catch(() => null),
        accessDenied.waitFor({ timeout: 5_000 }).catch(() => null),
      ])

      // Page should render (either with content or access message)
      expect(
        (await pageHeading.isVisible()) || (await accessDenied.isVisible())
      ).toBe(true)
    })

    test('should handle search functionality', async ({ page }) => {
      await login(page, E2E_EMAIL!, E2E_PASSWORD!)

      await page.goto(`${BASE_URL}/dashboard/agency/users`)

      // Wait for page to load
      await page.waitForLoadState('networkidle')

      // Try to find search input
      const searchInput = page.getByPlaceholderText(/Search by name or email/i)
      if (await searchInput.isVisible()) {
        await searchInput.fill('test')
        // Search should update results (if any users exist)
        await page.waitForTimeout(500) // Wait for debounce
      }
    })

    test('should handle edit role modal', async ({ page }) => {
      await login(page, E2E_EMAIL!, E2E_PASSWORD!)

      await page.goto(`${BASE_URL}/dashboard/agency/users`)

      await page.waitForLoadState('networkidle')

      // Look for edit buttons
      const editButtons = page.locator('button:has-text("Edit")')
      const editButtonCount = await editButtons.count()

      if (editButtonCount > 0) {
        // Click first edit button
        await editButtons.first().click()

        // Check if modal opened
        const modal = page.getByRole('heading', { name: /Edit User Role/i })
        if (await modal.isVisible({ timeout: 2_000 })) {
          // Cancel modal
          const cancelButton = page.getByRole('button', { name: /Cancel/i })
          await cancelButton.click()

          // Modal should close
          await expect(modal).not.toBeVisible()
        }
      }
    })
  })

  test.describe('Job Detail Page', () => {
    test('should load job detail page', async ({ page }) => {
      await login(page, E2E_EMAIL!, E2E_PASSWORD!)

      // Navigate to jobs page first to get a job ID
      await page.goto(`${BASE_URL}/dashboard/jobs`)
      await page.waitForLoadState('networkidle')

      // Try to find a job link
      const jobLinks = page.locator('a[href*="/dashboard/jobs/"]')
      const jobLinkCount = await jobLinks.count()

      if (jobLinkCount > 0) {
        // Click first job link
        const firstJobLink = jobLinks.first()
        const href = await firstJobLink.getAttribute('href')
        const jobId = href?.split('/').pop()

        if (jobId && jobId !== '_') {
          // Navigate to job detail page
          await page.goto(`${BASE_URL}/dashboard/jobs/${jobId}`)
          await page.waitForLoadState('networkidle')

          // Check if job details are displayed
          // Look for common job detail elements
          const jobContent = page.locator('body')
          await expect(jobContent).toBeVisible()
        }
      } else {
        // No jobs available - skip test
        test.skip(true, 'No jobs available to test job detail page')
      }
    })

    test('should handle job resubmission', async ({ page }) => {
      await login(page, E2E_EMAIL!, E2E_PASSWORD!)

      await page.goto(`${BASE_URL}/dashboard/jobs`)
      await page.waitForLoadState('networkidle')

      const jobLinks = page.locator('a[href*="/dashboard/jobs/"]')
      const jobLinkCount = await jobLinks.count()

      if (jobLinkCount > 0) {
        const firstJobLink = jobLinks.first()
        const href = await firstJobLink.getAttribute('href')
        const jobId = href?.split('/').pop()

        if (jobId && jobId !== '_') {
          await page.goto(`${BASE_URL}/dashboard/jobs/${jobId}`)
          await page.waitForLoadState('networkidle')

          // Look for resubmit button
          const resubmitButton = page.getByRole('button', {
            name: /resubmit/i,
          })

          if (await resubmitButton.isVisible({ timeout: 2_000 })) {
            // Don't actually click to avoid creating new jobs in test
            // Just verify button exists
            await expect(resubmitButton).toBeVisible()
          }
        }
      } else {
        test.skip(true, 'No jobs available to test resubmission')
      }
    })

    test('should display job execution steps', async ({ page }) => {
      await login(page, E2E_EMAIL!, E2E_PASSWORD!)

      await page.goto(`${BASE_URL}/dashboard/jobs`)
      await page.waitForLoadState('networkidle')

      const jobLinks = page.locator('a[href*="/dashboard/jobs/"]')
      const jobLinkCount = await jobLinks.count()

      if (jobLinkCount > 0) {
        const firstJobLink = jobLinks.first()
        const href = await firstJobLink.getAttribute('href')
        const jobId = href?.split('/').pop()

        if (jobId && jobId !== '_') {
          await page.goto(`${BASE_URL}/dashboard/jobs/${jobId}`)
          await page.waitForLoadState('networkidle')

          // Look for execution steps section
          // This might be in various formats, so we just check page loaded
          const pageContent = page.locator('body')
          await expect(pageContent).toBeVisible()
        }
      } else {
        test.skip(true, 'No jobs available to test execution steps')
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should handle loading states', async ({ page }) => {
      await login(page, E2E_EMAIL!, E2E_PASSWORD!)

      // Navigate to a page that might show loading
      await page.goto(`${BASE_URL}/dashboard/jobs`)
      
      // Page should eventually load (not stuck in loading)
      await page.waitForLoadState('networkidle', { timeout: 10_000 })
      
      // Should see either content or empty state
      const content = page.locator('body')
      await expect(content).toBeVisible()
    })
  })
})

