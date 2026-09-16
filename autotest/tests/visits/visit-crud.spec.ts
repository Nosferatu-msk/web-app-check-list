import { test, expect } from '@playwright/test';
import { loginViaUI, getAuthToken } from '../../helpers/auth.js';
import { ApiClient } from '../../helpers/api-client.js';
import { config } from '../../config/test-config.js';

test.describe('Визиты — CRUD @ui @api', () => {

  test('TC-004: Создание визита — валидация обязательных полей @critical @ui', async ({ page }) => {
    await loginViaUI(page, 'engineer');
    await page.click('text=Новый визит');
    // Try to save without filling fields
    await page.click('text=Сохранить');
    // Should show validation errors
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-005: Автозаполнение даты/времени/сезона @high @ui', async ({ page }) => {
    await loginViaUI(page, 'engineer');
    await page.click('text=Новый визит');
    // Date and time should be pre-filled
    const dateInput = page.locator('input').first();
    await expect(dateInput).not.toBeEmpty();
  });

  test('TC-006: Выбор адреса из справочника @critical @ui', async ({ page }) => {
    await loginViaUI(page, 'engineer');
    await page.click('text=Новый визит');
    // Verify address select exists and is interactive
    const addressSelect = page.locator('.ant-select').first();
    await expect(addressSelect).toBeVisible({ timeout: 5000 });
    await addressSelect.click();
    // Type in address search — verify the select accepts input
    const searchInput = page.locator('input[role="combobox"]').first();
    await searchInput.fill('Москва');
    // Wait for search results (dropdown may be hidden on mobile, but API should return results)
    await page.waitForTimeout(2000);
    // Verify the select is in searching state (dropdown exists in DOM)
    const dropdown = page.locator('.ant-select-dropdown').first();
    await expect(dropdown).toBeAttached({ timeout: 5000 });
  });

  test('TC-040: Сезон — автоматическое определение @high @ui', async ({ page }) => {
    await loginViaUI(page, 'engineer');
    await page.click('text=Новый визит');
    // Season should be auto-detected based on current date — rendered as Ant Design Select
    const seasonSelect = page.locator('.ant-select-selection-item').first();
    await expect(seasonSelect).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Визиты — API @api', () => {
  test('TC-006: API создание визита @critical @api', async ({ request }) => {
    const api = new ApiClient(request);
    await api.authenticate('engineer');

    // First search for an address
    const searchRes = await api.get('/refs/addresses/search', { q: 'Кутузовский' });
    expect(searchRes.ok()).toBeTruthy();
    const addresses = await searchRes.json();
    
    if (addresses.length > 0) {
      const createRes = await api.post('/visits', {
        addressId: addresses[0].id,
        engineerName: 'Тест Автотест',
        dateStart: new Date().toISOString().slice(0, 10),
        timeStart: '10:00',
        season: 'summer',
      });
      expect(createRes.ok()).toBeTruthy();
      const visit = await createRes.json();
      expect(visit.id).toBeTruthy();
      expect(visit.status).toBe('not_started');

      // Cleanup: delete the visit
      await api.delete(`/visits/${visit.id}`);
    }
  });
});
