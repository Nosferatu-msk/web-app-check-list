import { test, expect } from '@playwright/test';

test.describe('Авторизация', () => {
  test('TC-001: Вход инженера', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('Email').fill('engineer@example.com');
    await page.getByPlaceholder('Пароль').fill('engineer123');
    await page.getByRole('button', { name: 'Войти' }).click();

    // Ожидаем переход на главную
    await expect(page).toHaveURL('/');

    // Проверяем наличие кнопки "Новый визит" или списка визитов
    const hasNewVisitButton = await page.getByRole('button', { name: /новый визит/i }).isVisible().catch(() => false);
    const hasVisitList = await page.locator('.visit-card, .page-title').first().isVisible().catch(() => false);

    expect(hasNewVisitButton || hasVisitList).toBeTruthy();
  });

  test('TC-002: Вход администратора', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('Email').fill('admin@example.com');
    await page.getByPlaceholder('Пароль').fill('admin123');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page).toHaveURL('/');

    // Проверяем наличие кнопки "Админ"
    await expect(page.getByRole('button', { name: /админ/i })).toBeVisible();
  });

  test('TC-003: Неверный пароль', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('Email').fill('engineer@example.com');
    await page.getByPlaceholder('Пароль').fill('wrongpassword');
    await page.getByRole('button', { name: 'Войти' }).click();

    // Ожидаем сообщение об ошибке
    await expect(page.getByText(/неверн|ошибк|error/i).first()).toBeVisible({ timeout: 5000 });

    // URL должен остаться на /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-003b: Пустые поля при входе', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Войти' }).click();

    // Должны появиться ошибки валидации
    await expect(page.getByText(/введите email/i).first()).toBeVisible({ timeout: 3000 });
  });
});
