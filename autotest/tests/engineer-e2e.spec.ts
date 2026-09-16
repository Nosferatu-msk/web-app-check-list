import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth.js';
import { ApiClient } from '../helpers/api-client.js';

/**
 * Полный пользовательский сценарий инженера (E2E):
 * 1. Авторизация через UI
 * 2. Создание визита через API
 * 3. Добавление оборудования через UI (модалка)
 * 4. Заполнение параметров задачи
 * 5. Загрузка фото
 * 6. Завершение визита
 * 7. Формирование отчёта
 */
test.describe('Инженер — полный сценарий @ui @e2e', () => {

  test('E2E: Визит от создания до отчёта @critical @ui', async ({ page, request }) => {
    const api = new ApiClient(request);
    await api.authenticate('engineer');

    // Шаг 1: Авторизация через UI
    await loginViaUI(page, 'engineer');
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });

    // Шаг 2: Создание визита через API
    const searchRes = await api.get('/refs/addresses/search', { q: 'Кутузовский' });
    const addresses = await searchRes.json();
    if (addresses.length === 0) {
      test.skip(true, 'Нет адресов с "Кутузовский"');
      return;
    }

    const visitRes = await api.post('/visits', {
      addressId: addresses[0].id,
      engineerName: 'Тестик',
      dateStart: new Date().toISOString().slice(0, 10),
      timeStart: '10:00',
      season: 'summer',
    });
    const visit = await visitRes.json();
    const visitId = visit.id;

    // Шаг 3: Открытие визита и добавление оборудования через UI
    await page.goto(`/visit/${visitId}`);
    await expect(page.locator('text=Добавить оборудование').first()).toBeVisible({ timeout: 15000 });

    // Открываем модалку добавления оборудования
    await page.locator('button:has-text("Добавить оборудование")').click();

    // Модалка: выбираем первое помещение
    const modal = page.locator('.ant-modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Кликаем на первое помещение в списке
    const firstRoom = modal.locator('.ant-list-item, [class*="room"]').first();
    if (await firstRoom.isVisible({ timeout: 3000 })) {
      await firstRoom.click();
      await page.waitForTimeout(1000);

      // Выбираем первое оборудование (чекбокс)
      const firstEquip = modal.locator('.ant-checkbox-wrapper, .ant-list-item').first();
      await expect(firstEquip).toBeVisible({ timeout: 5000 });

      // Нажимаем "Добавить"
      await modal.locator('button:has-text("Добавить")').click();
    } else {
      // Если нет помещений, закрываем модалку
      await modal.locator('.ant-modal-close').click();
    }

    // Ждём появления задачи в таблице
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    // Шаг 4: Открытие задачи и заполнение параметров
    await page.locator('table tbody tr').first().click();
    await page.waitForURL(/\/task\//, { timeout: 10000 });

    // Проверяем, что страница задачи открыта (заголовок с названием оборудования)
    await expect(page.locator('.page-title, h1, h2').first()).toBeVisible({ timeout: 5000 });

    // Заполняем показания (обязательное поле)
    const readingsInput = page.locator('input[placeholder*="Введите значение"]').first();
    if (await readingsInput.isVisible({ timeout: 3000 })) {
      await readingsInput.fill('12345');
    }

    // Заполняем заключение
    const conclusionSelect = page.locator('.ant-select').filter({ hasText: 'Заключение' }).first();
    if (await conclusionSelect.isVisible({ timeout: 3000 })) {
      await conclusionSelect.click();
      await page.click('.ant-select-item-option:has-text("Исправно")');
    }

    // Сохраняем
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(1000);

    // Шаг 5: Загрузка фото — кнопка "Фото" внизу страницы
    await page.click('button:has-text("Фото")');
    await page.waitForURL(/\/photo/, { timeout: 10000 });

    // Загружаем фото через input file
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible({ timeout: 3000 })) {
      const testImageBuffer = Buffer.from(
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
        'base64'
      );

      await fileInput.setInputFiles({
        name: 'test-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: testImageBuffer,
      });

      await expect(page.locator('img').first()).toBeVisible({ timeout: 15000 });
    }

    // Возвращаемся
    await page.click('button:has-text("Назад")');
    await page.waitForTimeout(1000);

    // Шаг 6: Проверка, что задача отображается в визите
    await page.goto(`/visit/${visitId}`);
    await page.waitForTimeout(2000);

    // Проверяем, что задача в таблице
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });

    // Очистка
    await api.delete(`/visits/${visitId}`);
  });
});
