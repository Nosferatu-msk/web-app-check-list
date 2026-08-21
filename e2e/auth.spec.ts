import { test, expect } from '@playwright/test';

test.describe('Авторизация', () => {
  test('TC-001: Вход инженера', async ({ page }) => {
    await page.goto('/login');

    // Заполняем форму по label
    await page.getByLabel('Email').fill('engineer@example.com');
    await page.getByLabel('Пароль').fill('engineer123');
    await page.getByRole('button', { name: 'Войти' }).click();

    // Ожидаем переход на главную (или страницу выбора специализации)
    await page.waitForURL(/\/(visit|mtr|profile)?/, { timeout: 10000 });
  });

  test('TC-002: Вход администратора', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Пароль').fill('admin123');
    await page.getByRole('button', { name: 'Войти' }).click();

    // Ожидаем переход на главную
    await page.waitForURL(/\/(visit|mtr|profile|admin)?/, { timeout: 10000 });
  });

  test('TC-003: Неверный пароль', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('engineer@example.com');
    await page.getByLabel('Пароль').fill('wrongpassword');
    await page.getByRole('button', { name: 'Войти' }).click();

    // Ожидаем сообщение об ошибке (Ant Design message)
    await expect(page.locator('.ant-message').getByText(/неверн|ошибк|error/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-003b: Пустые поля при входе', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Войти' }).click();

    // Должны появиться ошибки валидации
    await expect(page.getByText(/введите email/i).first()).toBeVisible({ timeout: 5000 });
  });
});
