# E2E Testing with Playwright

This directory contains end-to-end tests for the frontend application using Playwright.

## Setup

1. Install dependencies (from repo root):
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

You can run these tests via the `frontend` workspace scripts or directly from the repo root using the helper scripts.

### Recommended (Repo Root)

```bash
# Run all tests
./scripts/testing/test-e2e.sh
```

### Direct (Frontend Workspace)

Run these from the `frontend/` directory:

```bash
# Run all tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/auth.spec.ts
```

## Configuration

Tests are configured in `playwright.config.ts`. Key settings:

- **Base URL**: `http://localhost:3000` (override with `FRONTEND_URL`)
- **Test directory**: `./tests`
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari

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

## Best Practices

1. Use **Page Object Models** for maintainability.
2. Use **fixtures** for common operations (login, logout).
3. Use **accessibility selectors** (`getByRole`, `getByLabel`) when possible.
4. Clean up test data after tests.
