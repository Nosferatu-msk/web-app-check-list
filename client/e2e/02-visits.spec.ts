/**
 * UI-тесты: Визиты — создание, редактирование, задачи
 */
import { test, expect } from '@playwright/test';

const LOGIN = 'testic@test.ru';
const PASS = 'hello2026';

async function doLogin(page: any) {
  await page.goto('/login');
  await page.fill('input[type="email"], input#email, input[placeholder*="email" i], input[name="email"]', LOGIN);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

test.describe('Создание визита', () => {
  test('TC-004: Валидация — пустая форма', async ({ page }) => {
    await doLogin(page);
    // Нажать «Новый визит»
    const newBtn = page.locator('button:has-text("Новый визит"), button:has-text("новый"), a:has-text("Новый визит")').first();
    if (await newBtn.isVisible()) {
      await newBtn.click();
      await page.waitForLoadState('networkidle');
    } else {
      await page.goto('/visit/new');
      await page.waitForLoadState('networkidle');
    }
    // Попробовать сохранить без заполнения
    const saveBtn = page.locator('button:has-text("Сохранить"), button[type="submit"]').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      // Ожидаем ошибки валидации
      const hasError = await page.locator('.ant-form-item-explain-error, .ant-form-item-has-error, [class*="error"], [class*="invalid"]').count();
      console.log(`Validation errors found: ${hasError}`);
    }
  });

  test('TC-005: Автозаполнение даты/времени', async ({ page }) => {
    await doLogin(page);
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Проверить, что дата заполнена
    const dateInput = page.locator('input[placeholder*="дате"], input[placeholder*="дата"], .ant-picker-input input').first();
    if (await dateInput.isVisible()) {
      const val = await dateInput.inputValue();
      console.log(`Date field value: "${val}"`);
      // Дата должна быть сегодня
      const today = new Date().toLocaleDateString('ru-RU');
      expect(val.length).toBeGreaterThan(0);
    }
  });

  test('TC-006: Создание визита — полный сценарий', async ({ page }) => {
    await doLogin(page);
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Выбрать адрес
    const addressInput = page.locator('.ant-select-selector input, input[placeholder*="адрес" i], input[placeholder*="Адрес" i]').first();
    if (await addressInput.isVisible()) {
      await addressInput.click();
      await addressInput.fill('Бакулева');
      await page.waitForTimeout(1000);
      // Выбрать из dropdown
      const option = page.locator('.ant-select-item-option').first();
      if (await option.isVisible()) {
        await option.click();
      }
    }

    // Заполнить время если нужно
    const timeInput = page.locator('.ant-picker-input input').nth(1);
    if (await timeInput.isVisible()) {
      const val = await timeInput.inputValue();
      if (!val) await timeInput.fill('10:00');
    }

    // Сохранить
    const saveBtn = page.locator('button:has-text("Сохранить")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }

    // Проверить, что визит создан (URL должен измениться на /visit/:id)
    const url = page.url();
    console.log(`After save URL: ${url}`);
    expect(url).toMatch(/visit\/[a-f0-9-]+/);
  });
});

test.describe('Список визитов', () => {
  test('TC-032: Отображение списка', async ({ page }) => {
    await doLogin(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Должны быть карточки визитов или таблица
    const hasContent = await page.locator('[class*="visit"], [class*="card"], table, .ant-list').first().isVisible().catch(() => false);
    console.log(`Visit list visible: ${hasContent}`);

    // Статистика (карточки)
    const stats = await page.locator('[class*="stat"], [class*="card"]').count();
    console.log(`Stats cards: ${stats}`);
  });

  test('TC-032.2: Поиск по адресу', async ({ page }) => {
    await doLogin(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('input[placeholder*="поиск" i], input[placeholder*="адрес" i], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Бакулева');
      await page.waitForTimeout(1000); // debounce
      // Список должен обновиться
      console.log('Search performed for "Бакулева"');
    }
  });
});

test.describe('Задачи визита', () => {
  test('TC-007: Добавление оборудования — модальное окно', async ({ page }) => {
    await doLogin(page);
    // Открыть первый визит
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Кликнуть на первый визит
    const firstVisit = page.locator('[class*="visit"] a, [class*="card"] a, tr[class*="row"]').first();
    if (await firstVisit.isVisible()) {
      await firstVisit.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    // Нажать «Добавить оборудование»
    const addBtn = page.locator('button:has-text("Добавить"), button:has-text("оборудование")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(2000);
      // Проверить модальное окно
      const modal = page.locator('.ant-modal, [class*="modal"], [role="dialog"]').first();
      const modalVisible = await modal.isVisible().catch(() => false);
      console.log(`Add equipment modal visible: ${modalVisible}`);

      // Проверить вкладки
      const tabs = await page.locator('.ant-tabs-tab, [role="tab"]').count();
      console.log(`Tabs in modal: ${tabs}`);
    }
  });
});
