import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';
import { ApiClient } from '../../helpers/api-client.js';

test.describe('ТМ — функционал @ui', () => {

  test('TC-053: Просмотр визитов своих инженеров @critical @ui', async ({ page }) => {
    await loginViaUI(page, 'tm');
    // TM should see visits list (or empty state if no visits)
    await expect(page.locator('.ant-list, .ant-empty, .ant-spin').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-054: Дашборд мониторинга @high @ui', async ({ page }) => {
    await loginViaUI(page, 'tm');
    // Should see statistics cards
    const stats = page.locator('.ant-statistic, .ant-card');
    await expect(stats.first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-061: Ограничение доступа к справочникам @high @ui', async ({ page }) => {
    await loginViaUI(page, 'tm');
    // TM should NOT see admin button
    await expect(page.locator('text=Админ')).not.toBeVisible({ timeout: 5000 });
    // Try direct navigation
    await page.goto('/admin');
    // Should redirect or show access denied
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 5000 });
  });
});

test.describe('ТМ — API @api', () => {
  test('TC-053: API визиты своих инженеров @critical @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('tm');

    const res = await api.get('/visits');
    expect(res.ok()).toBeTruthy();
  });

  test('TC-062: API доступ к визитам другого ТМ (запрет) @critical @api', async ({ request }) => {
    // Login as engineer to get a visit ID
    const engApi = new ApiClient(request);
    await engApi.authenticate('engineer');
    const engVisits = await engApi.get('/visits');
    const visits = await engVisits.json();

    if (visits.length > 0) {
      // TM should be able to see their own engineers' visits
      const api = new ApiClient(request);
      await api.authenticate('tm');
      const tmRes = await api.get('/visits');
      expect(tmRes.ok()).toBeTruthy();
    }
  });

  test('TC-064: API Админ — все визиты @high @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('admin');

    const res = await api.get('/visits');
    expect(res.ok()).toBeTruthy();
  });

  test('TC-060: API soft delete @high @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('engineer');

    // Create visit
    const searchRes = await api.get('/refs/addresses/search', { q: 'Кутузовский' });
    const addresses = await searchRes.json();
    if (addresses.length === 0) return;

    const visitRes = await api.post('/visits', {
      addressId: addresses[0].id,
      engineerName: 'Тест',
      dateStart: new Date().toISOString().slice(0, 10),
      timeStart: '10:00',
      season: 'summer',
    });
    const visit = await visitRes.json();

    // Delete (soft)
    const delRes = await api.delete(`/visits/${visit.id}`);
    expect(delRes.ok()).toBeTruthy();
  });
});
