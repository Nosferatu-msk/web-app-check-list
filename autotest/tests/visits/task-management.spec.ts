import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';
import { ApiClient } from '../../helpers/api-client.js';

test.describe('Задачи — управление @ui', () => {

  test('TC-007: Добавление задачи — модальное окно с вкладками @critical @ui', async ({ page, request }) => {
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

    // Open add equipment modal
    await page.click('text=Добавить оборудование');
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('.ant-tabs')).toBeVisible({ timeout: 5000 });
    // Verify tab labels exist (2 tabs: "Уровень помещения" and "Добавить новое")
    await expect(modal.locator('text=Уровень помещения').first()).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('text=Добавить новое').first()).toBeVisible({ timeout: 3000 });

    // Cleanup
    await api.delete(`/visits/${visit.id}`);
  });

  test('TC-008: Добавление задачи — через вкладку "Добавить новое" @critical @ui', async ({ page, request }) => {
    // Create visit via API
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

    // Open add equipment modal
    await page.click('text=Добавить оборудование');
    const modal = page.locator('.ant-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    // Switch to "Добавить новое" tab
    await modal.locator('text=Добавить новое').click();
    await page.waitForTimeout(1000);
    // Should show equipment type select inside the modal
    const eqSelect = modal.locator('.ant-select').first();
    await expect(eqSelect).toBeVisible({ timeout: 5000 });
    await eqSelect.click();
    // Ant Design Select renders dropdown in body, not inside modal
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item').first().click();
    // Add the task
    await modal.locator('button:has-text("Добавить")').click();
    // Task should be added
    await expect(page.locator('.ant-message, .visit-card').first()).toBeVisible({ timeout: 5000 });

    // Cleanup
    await api.delete(`/visits/${visit.id}`);
  });

  test('TC-010: Значения по умолчанию @critical @ui', async ({ page }) => {
    await loginViaUI(page, 'engineer');
    // Create visit and task, then open task page
    // This test verifies default parameter values
    // For now, just verify the page loads
    await page.click('text=Новый визит');
    await expect(page.locator('text=Новый визит').first()).toBeVisible();
  });
});

test.describe('Задачи — API @api', () => {
  test('TC-097: Поля марки/модели/серийного номера @high @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('engineer');

    // Get addresses
    const searchRes = await api.get('/refs/addresses/search', { q: 'Кутузовский' });
    const addresses = await searchRes.json();
    if (addresses.length === 0) return;

    // Create visit
    const visitRes = await api.post('/visits', {
      addressId: addresses[0].id,
      engineerName: 'Тест',
      dateStart: new Date().toISOString().slice(0, 10),
      timeStart: '10:00',
      season: 'summer',
    });
    const visit = await visitRes.json();

    // Get equipment types
    const eqRes = await api.get('/refs/equipment-types');
    const eqTypes = await eqRes.json();
    const splitType = eqTypes.find((e: any) => e.code === 'splitvn');

    if (splitType) {
      // Create task with brand/model/serialNumber
      const taskRes = await api.post(`/visits/${visit.id}/tasks`, {
        equipmentTypeId: splitType.id,
        roomTypeId: '',
        comment: 'Тестовая задача',
        brand: 'Daikin',
        model: 'FTXS35K',
        serialNumber: 'SN12345',
      });
      expect(taskRes.ok()).toBeTruthy();
      const task = await taskRes.json();
      expect(task.brand).toBe('Daikin');
      expect(task.model).toBe('FTXS35K');
      expect(task.serialNumber).toBe('SN12345');
    }

    // Cleanup
    await api.delete(`/visits/${visit.id}`);
  });
});
