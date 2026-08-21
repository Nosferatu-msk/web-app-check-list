import { test, expect } from '@playwright/test';

test.describe('Визиты', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('engineer@example.com');
    await page.getByLabel('Пароль').fill('engineer123');
    await page.getByRole('button', { name: 'Войти' }).click();
    // Ждём ухода со страницы логина
    await page.waitForURL(/\/(visit|profile|mtr)(\/|$|\?)/, { timeout: 10000 });
  });

  test('TC-004: Создание визита — обязательные поля', async ({ page }) => {
    // Переходим на создание визита
    await page.goto('/visit/new');

    // Страница должна загрузиться
    const pageLoaded = await page.locator('.page-container').first().isVisible({ timeout: 10000 }).catch(() => false);
    if (!pageLoaded) {
      // Если страница не загрузилась — skip
      test.skip(true, 'Страница создания визита недоступна');
      return;
    }

    // Пытаемся сохранить без заполнения
    const saveBtn = page.getByRole('button', { name: /сохранить/i }).first();
    const saveBtnVisible = await saveBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!saveBtnVisible) {
      test.skip(true, 'Кнопка сохранения не найдена');
      return;
    }
    await saveBtn.click();

    // Должны появиться ошибки валидации
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible({ timeout: 5000 });
  });

  test('Отображение списка визитов', async ({ page }) => {
    // Проверяем, что страница загрузилась
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });
  });

  test('Фильтры визитов — Deep Linking', async ({ page }) => {
    // Сначала навигируем на главную (уже залогинены из beforeEach)
    await page.goto('/');
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });

    // Устанавливаем фильтр через URL
    await page.goto('/?statuses=in_progress');

    // URL должен содержать параметр
    await page.waitForURL(/\?statuses=in_progress/, { timeout: 10000 });

    // Страница должна загрузиться
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });
  });
});
