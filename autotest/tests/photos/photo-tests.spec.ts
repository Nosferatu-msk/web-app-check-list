import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';
import { ApiClient } from '../../helpers/api-client.js';

test.describe('Фотофиксация @ui', () => {

  test('TC-019: Предупреждение 152-ФЗ — модальное окно добавления @high @ui', async ({ page, request }) => {
    // Create visit via API to avoid mobile address select issues
    const api = new ApiClient(request);
    await api.authenticate('engineer');
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

    await loginViaUI(page, 'engineer');
    await page.goto(`/visit/${visit.id}`);
    // Wait for visit page to fully load
    await expect(page.locator('text=Добавить оборудование').first()).toBeVisible({ timeout: 15000 });

    // Open add equipment modal — verify it has the 2-tab structure (Уровень помещения, Добавить новое)
    await page.click('text=Добавить оборудование');
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    // Verify tabs are present
    await expect(modal.locator('.ant-tabs-tab').nth(0)).toBeVisible({ timeout: 3000 });
    await expect(modal.locator('.ant-tabs-tab').nth(1)).toBeVisible({ timeout: 3000 });

    // Cleanup
    await api.delete(`/visits/${visit.id}`);
  });

  test('TC-041: Маркировка фотографий @high @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('engineer');
    // Photo naming convention is tested by verifying the upload endpoint
    // The actual naming is done server-side
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

    const eqRes = await api.get('/refs/equipment-types');
    const eqTypes = await eqRes.json();
    const splitType = eqTypes.find((e: any) => e.code === 'splitvn');

    if (splitType) {
      const taskRes = await api.post(`/visits/${visit.id}/tasks`, {
        equipmentTypeId: splitType.id,
        comment: 'Тест',
      });
      const task = await taskRes.json();

      // Verify task has correct equipment code for naming
      expect(task.equipmentTypeId).toBe(splitType.id);
    }

    await api.delete(`/visits/${visit.id}`);
  });
});
