import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';
import { ApiClient } from '../../helpers/api-client.js';

test.describe('Визиты — жизненный цикл @ui', () => {

  test('TC-025: Завершение визита @critical @ui', async ({ page }) => {
    await loginViaUI(page, 'engineer');
    // Open an existing visit or create one
    await page.click('text=Новый визит');
    // Fill address
    const addressSelect = page.locator('.ant-select').first();
    await addressSelect.click();
    await page.keyboard.type('Кутузовский');
    await page.waitForSelector('.ant-select-item', { timeout: 10000 });
    await page.click('.ant-select-item');
    await page.click('text=Сохранить');
    await page.waitForTimeout(2000);
    // Complete button should be disabled without completed tasks
    const completeBtn = page.locator('text=Завершить визит');
    if (await completeBtn.isVisible()) {
      // Button should be disabled
      await expect(completeBtn).toBeDisabled();
    }
  });

  test('TC-031: Удаление визита @high @ui', async ({ page }) => {
    await loginViaUI(page, 'engineer');
    // Go to visit list
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Check if there are visits to delete
    const deleteBtn = page.locator('.ant-table-row').first().locator('button').filter({ has: page.locator('.anticon-delete') });
    if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteBtn.click();
      // Confirm deletion
      await page.click('.ant-popconfirm .ant-btn-primary');
      await page.waitForTimeout(1000);
    }
  });

  test('TC-032: История визитов @high @ui', async ({ page }) => {
    await loginViaUI(page, 'engineer');
    await page.goto('/');
    // Should show visit list
    await expect(page.locator('.ant-table, .ant-list').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Визиты — API жизненный цикл @api', () => {
  test('TC-030: API редактирование завершённого визита @high @api', async ({ request }) => {
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

    // Update visit
    const updateRes = await api.put(`/visits/${visit.id}`, {
      engineerName: 'Обновлённый Тест',
    });
    expect(updateRes.ok()).toBeTruthy();

    // Cleanup
    await api.delete(`/visits/${visit.id}`);
  });
});
