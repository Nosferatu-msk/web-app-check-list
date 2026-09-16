import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';

test.describe('Пагинация @ui', () => {

  test('TC-097: Пагинация в перечне оборудования @high @ui', async ({ page }) => {
    await loginViaUI(page, 'admin');
    // Navigate directly to the object equipment page
    await page.goto('/admin/object-equipment');
    await page.waitForTimeout(2000);
    // Check pagination is visible
    const pagination = page.locator('.ant-pagination');
    await expect(pagination.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-098: Пагинация в рекомендациях @high @ui', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await page.goto('/admin/recommendations');
    await page.waitForTimeout(2000);
    const pagination = page.locator('.ant-pagination');
    await expect(pagination.first()).toBeVisible({ timeout: 5000 });
  });
});
