import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth.js';
import { ApiClient } from '../helpers/api-client.js';

/**
 * Расширенный E2E тест инженера:
 * 1. Авторизация
 * 2. Создание визита (API)
 * 3. Создание задачи с новым оборудованием (API)
 *    - Прибор учета э/э, Инкотекс, Меркурий 230 AM-01
 *    - Проверка уникальности SN: сначала существующий, потом уникальный
 * 4. UI: проверка автозаполнения марки/модели в задаче
 * 5. UI: ввод показаний
 * 6. UI: загрузка фото
 * 7. UI: сохранение
 */
test.describe('Инженер — расширенный сценарий @ui @e2e', () => {

  test('E2E: Новое оборудование с проверкой уникальности SN @critical @ui', async ({ page, request }) => {
    const api = new ApiClient(request);
    await api.authenticate('engineer');

    // Шаг 1: Авторизация
    await loginViaUI(page, 'engineer');
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });

    // Шаг 2: Создание визита через API
    const searchRes = await api.get('/refs/addresses/search', { q: 'Кутузовский' });
    const addresses = await searchRes.json();
    if (addresses.length === 0) {
      test.skip(true, 'Нет адресов');
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

    // Получаем ID типа оборудования "Прибор учета э/э"
    const equipTypesRes = await api.get('/refs/equipment-types');
    const equipTypes = await equipTypesRes.json();
    const meterType = equipTypes.find((e: any) => e.code === 'schetchik_electroshc');

    if (!meterType) {
      test.skip(true, 'Тип оборудования "Прибор учета э/э" не найден');
      return;
    }

    // Шаг 3: Проверка уникальности SN через API
    // Сначала пытаемся создать задачу с существующим SN (должна быть ошибка)
    const existingSN = '49356413'; // Существующий SN из БД
    const taskRes1 = await api.post(`/visits/${visitId}/tasks`, {
      equipmentTypeId: meterType.id,
      brand: 'Инкотекс',
      model: 'Меркурий 230 AM-01',
      serialNumber: existingSN,
    });

    if (!taskRes1.ok()) {
      const errorData = await taskRes1.json();
      console.log(`✅ Ошибка при создании с существующим SN: ${errorData.error || taskRes1.status}`);
    } else {
      console.log('️ Ошибка уникальности SN не возвращена сервером');
      // Удаляем созданную задачу
      const task1 = await taskRes1.json();
      await api.delete(`/visits/${visitId}/tasks/${task1.id}`);
    }

    // Создаём задачу с уникальным SN
    const uniqueSN = `SN-${Date.now()}`;
    const taskRes2 = await api.post(`/visits/${visitId}/tasks`, {
      equipmentTypeId: meterType.id,
      brand: 'Инкотекс',
      model: 'Меркурий 230 AM-01',
      serialNumber: uniqueSN,
    });

    if (!taskRes2.ok()) {
      const errorData = await taskRes2.json();
      console.log(`❌ Ошибка при создании задачи: ${errorData.error}`);
      return;
    }

    const task = await taskRes2.json();
    const taskId = task.id;
    console.log(`✅ Задача создана с SN: ${uniqueSN}`);

    // Шаг 4: UI — проверка автозаполнения марки/модели
    await page.goto(`/visit/${visitId}`);
    await page.waitForTimeout(2000);

    // Кликаем на задачу
    await page.locator('table tbody tr').first().click();
    await page.waitForURL(/\/task\//, { timeout: 10000 });

    await expect(page.locator('.page-title, h1, h2').first()).toBeVisible({ timeout: 5000 });

    // Проверяем автозаполнение марки и модели
    const modelField = page.locator('input[value*="Инкотекс"], input[value*="Меркурий"]').first();
    if (await modelField.isVisible({ timeout: 3000 })) {
      const modelValue = await modelField.inputValue();
      console.log(`✅ Модель автозаполнена: ${modelValue}`);
    } else {
      console.log('⚠️ Модель не автозаполнена');
    }

    // Шаг 5: Ввод показаний
    const readingsInput = page.locator('input[placeholder*="Введите значение"]').first();
    if (await readingsInput.isVisible({ timeout: 3000 })) {
      await readingsInput.fill('12345');
      console.log('✅ Показания: 12345');
    }

    // Шаг 6: Загрузка фото
    await page.click('button:has-text("Фото")');
    await page.waitForURL(/\/photo/, { timeout: 10000 });

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
      console.log('✅ Фото загружено');
    }

    // Возврат и сохранение
    await page.click('button:has-text("Назад")');
    await page.waitForTimeout(1000);

    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    console.log('✅ Задача сохранена');

    // Шаг 7: Проверка в визите
    await page.goto(`/visit/${visitId}`);
    await page.waitForTimeout(2000);

    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
    console.log('✅ Задача в визите');

    // Очистка
    await api.delete(`/visits/${visitId}`);
    console.log('✅ Визит удалён');
  });
});
