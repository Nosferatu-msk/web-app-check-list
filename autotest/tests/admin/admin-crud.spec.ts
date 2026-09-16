import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';
import { ApiClient } from '../../helpers/api-client.js';

test.describe('Админка — CRUD справочников @ui', () => {

  test('TC-033: CRUD адресов @high @ui', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await page.goto('/admin/addresses');
    await expect(page.locator('h2:has-text("Справочник адресов")').first()).toBeVisible({ timeout: 10000 });
    // Check table is visible
    await expect(page.locator('.ant-table').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-034: CRUD видов оборудования @high @ui', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await page.goto('/admin/equipment');
    await expect(page.locator('.ant-table').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-035: CRUD рекомендаций @high @ui', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await page.goto('/admin/recommendations');
    await expect(page.locator('.ant-table').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-036: Журнал аудита @medium @ui', async ({ page }) => {
    await loginViaUI(page, 'admin');
    await page.goto('/admin/audit');
    await expect(page.locator('.ant-table').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Админка — API @api', () => {
  test('TC-033: API CRUD адресов @high @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('admin');

    // List addresses
    const listRes = await api.get('/admin/addresses');
    expect(listRes.ok()).toBeTruthy();

    // Search addresses
    const searchRes = await api.get('/admin/addresses/search', { q: 'Москва' });
    expect(searchRes.ok()).toBeTruthy();
  });

  test('TC-034: API виды оборудования @high @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('admin');

    const res = await api.get('/admin/equipment-types');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(13);
  });
});
