import { Page, APIRequestContext } from '@playwright/test';
import { config } from '../config/test-config.js';

export type UserRole = 'admin' | 'tm' | 'engineer';

export async function loginViaUI(page: Page, role: UserRole): Promise<void> {
  const creds = config.credentials[role];
  await page.goto('/login');
  await page.fill('input[type="email"], input#email, input[name="email"]', creds.email);
  await page.fill('input[type="password"], input#password, input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: config.timeouts.navigation });
}

export async function getAuthToken(apiContext: APIRequestContext, role: UserRole): Promise<string> {
  const creds = config.credentials[role];
  const response = await apiContext.post(`${config.apiURL}/auth/login`, {
    data: { email: creds.email, password: creds.password },
  });
  if (!response.ok()) {
    throw new Error(`Login failed for ${role}: ${response.status()} ${await response.text()}`);
  }
  const data = await response.json();
  return data.accessToken;
}

export async function createAuthenticatedContext(apiContext: APIRequestContext, role: UserRole): Promise<{ headers: Record<string, string> }> {
  const token = await getAuthToken(apiContext, role);
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}
