import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Use environment variables or defaults matching playwright.config.ts
  const email = process.env.NEXT_PUBLIC_MOCK_AUTH_EMAIL || 'test@example.com';
  const password = process.env.NEXT_PUBLIC_MOCK_AUTH_PASSWORD || 'TestPass123!';

  await page.goto(baseURL + '/auth/login');
  
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');

  // Retry logic for 404s (copied from auth fixture)
  try {
    await emailInput.waitFor({ timeout: 10000 });
  } catch {
    await page.goto(baseURL + '/auth/login');
    await emailInput.waitFor({ timeout: 10000 });
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.click('button[type="submit"]');
  
  // Wait for navigation after login
  await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 10000 });
  
  // Ensure directory exists
  const authFile = path.join(__dirname, '.auth/user.json');
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Save signed-in state to 'playwright/.auth/user.json'
  await page.context().storageState({ path: authFile });
  
  await browser.close();
}

export default globalSetup;
