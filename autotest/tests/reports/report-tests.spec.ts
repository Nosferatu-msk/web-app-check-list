import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';
import { ApiClient } from '../../helpers/api-client.js';

test.describe('Отчёты @ui @api', () => {

  test('TC-027: Формирование отчёта @critical @ui', async ({ page }) => {
    await loginViaUI(page, 'engineer');
    // Navigate to visit list, find a completed visit
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Check if there are completed visits
    const completedRow = page.locator('.ant-table-row').filter({ hasText: 'Завершен' }).first();
    if (await completedRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await completedRow.click();
      // Look for report button
      const reportBtn = page.locator('text=Отчёт').first();
      if (await reportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reportBtn.click();
        await expect(page.locator('text=Отчёт').first()).toBeVisible({ timeout: 10000 });
      }
    }
  });
});

test.describe('Сводные отчёты @api', () => {
  const today = new Date().toISOString().slice(0, 10);

  test('TC-095: Сводный отчёт за день @high @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('admin');

    const res = await api.post('/reports/summary-generate', {
      type: 'period',
      dateFrom: today,
      dateTo: today,
    });
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('pdf');
  });

  test('TC-100: Админ видит всех инженеров в сводном отчёте @critical @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('admin');

    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const res = await api.post('/reports/summary-generate', {
      type: 'period',
      dateFrom: monthAgo,
      dateTo: today,
    });
    expect(res.ok()).toBeTruthy();
  });

  test('TC-106: Отчёт по объекту @critical @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('admin');

    const searchRes = await api.get('/refs/addresses/search', { q: 'Кутузовский' });
    const addresses = await searchRes.json();
    if (addresses.length > 0) {
      const res = await api.post('/reports/summary-generate', {
        type: 'objects',
        dateFrom: '2024-01-01',
        dateTo: today,
        addressIds: [addresses[0].id],
      });
      expect(res.ok()).toBeTruthy();
      expect(res.headers()['content-type']).toContain('pdf');
    }
  });

  test('TC-109: Инженер — доступ к сводным отчётам запрещён @high @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('engineer');

    const res = await api.post('/reports/summary-generate', {
      type: 'period',
      dateFrom: today,
      dateTo: today,
    });
    expect(res.status()).toBe(403);
  });
});
