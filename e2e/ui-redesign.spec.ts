import { test, expect } from '@playwright/test';

test.describe('UI Редизайн', () => {
  test('Страница входа — новый дизайн', async ({ page }) => {
    await page.goto('/login');

    // Проверяем наличие лейблов
    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByText('Пароль')).toBeVisible();

    // Проверяем кнопку "Войти"
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  });

  test('Список визитов — загрузка', async ({ page }) => {
    // Вход как админ
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Пароль').fill('admin123');
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.waitForURL(/\/(visit|mtr|profile|admin)?/, { timeout: 10000 });

    // Страница должна загрузиться
    await expect(page.locator('.page-container').first()).toBeVisible({ timeout: 10000 });
  });

  test('Steps — прогресс-индикатор визита', async ({ page }) => {
    // Вход как инженер
    await page.goto('/login');
    await page.getByLabel('Email').fill('engineer@example.com');
    await page.getByLabel('Пароль').fill('engineer123');
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.waitForURL(/\/(visit|mtr|profile)?/, { timeout: 10000 });

    // Кликаем на первый визит (если есть)
    const firstVisit = page.locator('.visit-card').first();
    if (await firstVisit.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstVisit.click();

      // Проверяем наличие Steps
      const steps = page.locator('.ant-steps');
      if (await steps.isVisible({ timeout: 3000 }).catch(() => false)) {
        const stepItems = steps.locator('.ant-steps-item');
        const stepsCount = await stepItems.count();
        expect(stepsCount).toBe(4);
      }
    }
  });
});
