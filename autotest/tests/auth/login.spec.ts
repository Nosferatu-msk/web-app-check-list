import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';

test.describe('Авторизация @ui', () => {

  test('TC-001: Вход инженера @critical @ui', async ({ page }) => {
    await loginViaUI(page, 'engineer');
    await expect(page).toHaveURL(/\/$/);
    // Verify engineer sees visit list
    await expect(page.locator('text=Новый визит').first()).toBeVisible();
  });

  test('TC-002: Вход администратора @critical @ui', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await expect(page).toHaveURL(/\/$/);
    // Admin should have access to admin panel — verify by navigating to it
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
  });

  test('TC-003: Неверный пароль @high @ui', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input#email, input[name="email"]', 'engineer@example.com');
    await page.fill('input#password, input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should show error message
    await expect(page.locator('text=Неверный').first()).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-046: Регистронезависимый логин @high @ui', async ({ page }) => {
    const creds = (await import('../../config/test-config.js')).config.credentials.engineer;
    await page.goto('/login');
    await page.fill('input#email, input[name="email"]', creds.email.toUpperCase());
    await page.fill('input#password, input[name="password"]', creds.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
  });

  test('TC-052: Вход ТМ @critical @ui', async ({ page }) => {
    await loginViaUI(page, 'tm');
    await expect(page).toHaveURL(/\/$/);
  });
});
