# E2E Testing with Playwright

This directory contains end-to-end tests for the frontend application using Playwright.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run tests in debug mode
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test tests/auth.spec.ts
```

### Run tests for specific browser
```bash
npx playwright test --project=chromium
```

## Test Structure

- `tests/` - Test files
  - `auth.spec.ts` - Authentication tests (login, signup, logout)
  - `dashboard.spec.ts` - Dashboard page tests
  - `workflows.spec.ts` - Workflow management tests
  - `forms-jobs.spec.ts` - Forms, jobs, and settings tests

- `pages/` - Page Object Models
  - `LoginPage.ts` - Login page interactions
  - `DashboardPage.ts` - Dashboard page interactions

- `fixtures/` - Test fixtures and helpers
  - `auth.ts` - Authentication helpers (login, logout)

## Configuration

Tests are configured in `playwright.config.ts`. Key settings:

- Base URL: `http://localhost:3000` (or `FRONTEND_URL` env var)
- Test directory: `./tests`
- Retries: 2 on CI, 0 locally
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari

## Environment Variables

- `FRONTEND_URL` - Frontend URL (default: `http://localhost:3000`)
- `CI` - Set to `true` in CI environments

## Writing Tests

### Using Page Objects

```typescript
import { test, expect } from '../fixtures/auth'
import { DashboardPage } from '../pages/DashboardPage'

test('should display dashboard', async ({ page }) => {
  const dashboardPage = new DashboardPage(page)
  await dashboardPage.goto()
  await expect(dashboardPage.heading).toBeVisible()
})
```

### Using Auth Fixtures

```typescript
import { test, expect } from '../fixtures/auth'

test('should login', async ({ login }) => {
  await login('user@example.com', 'password')
  // User is now logged in
})
```

## Best Practices

1. Use Page Object Models for maintainability
2. Use fixtures for common operations (login, logout)
3. Use descriptive test names
4. Wait for elements explicitly
5. Use accessibility selectors when possible
6. Clean up test data after tests

## Debugging

- Use `npm run test:e2e:debug` to run tests in debug mode
- Use `npm run test:e2e:ui` for interactive debugging
- Check `test-results/` for screenshots and traces
- View HTML report: `npx playwright show-report`
