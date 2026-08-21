import { test, expect } from '@playwright/test';

test.describe('Визиты', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('engineer@example.com');
    await page.getByLabel('Пароль').fill('engineer123');
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.waitForURL(/\/(visit|mtr|profile)?/, { timeout: 10000 });
  });

  test('TC-004: Создание визита — обязательные поля', async ({ page }) => {
    // Переходим на создание визита
    await page.goto('/visit/new');

    // Пытаемся сохранить без заполнения
    await page.getByRole('button', { name: /сохранить/i }).click();

    // Должны появиться ошибки валидации
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible({ timeout: 5000 });
  });

  test('Отображение списка визитов', async ({ page }) => {
    // Проверяем, что страница загрузилась
    await expect(page.locator('.page-container, .page-title').first()).toBeVisible({ timeout: 10000 });
  });

  test('Фильтры визитов — Deep Linking', async ({ page }) => {
    // Устанавливаем фильтр через URL
    await page.goto('/?statuses=in_progress');

    // URL должен содержать параметр
    await expect(page).toHaveURL(/statuses=in_progress/);

    // Страница должна загрузиться
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });
  });
});
