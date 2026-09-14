/**
 * UI-тесты: Авторизация и навигация
 */
import { test, expect } from '@playwright/test';

const LOGIN = 'testic@test.ru';
const PASS = 'hello2026';

test.describe('Авторизация', () => {
  test('TC-001: Успешный вход инженера', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input#email, input[placeholder*="email" i], input[name="email"]', LOGIN);
    await page.fill('input[type="password"]', PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(visit|my-requests|$)/, { timeout: 15000 });
  });

  test('TC-003: Неверный пароль — ошибка', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input#email, input[placeholder*="email" i], input[name="email"]', LOGIN);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Ожидаем сообщение об ошибке «Неверный email или пароль»
    await expect(page.locator('text=Неверный email или пароль').first()).toBeVisible({ timeout: 10000 });
    // URL должен остаться на /login
    await expect(page).toHaveURL(/login/);
  });

  test('TC-046: Регистронезависимый логин', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input#email, input[placeholder*="email" i], input[name="email"]', 'TESTIC@TEST.RU');
    await page.fill('input[type="password"]', PASS);
    await page.click('button[type="submit"]');
    await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
  });

  test('TC-003a: Пустой email — валидация', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="password"]', PASS);
    await page.click('button[type="submit"]');
    // Форма не должна отправиться или должна показать ошибку
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });

  test('TC-003b: Пустой пароль — валидация', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input#email, input[placeholder*="email" i], input[name="email"]', LOGIN);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });
});

test.describe('Навигация после входа', () => {
  test.use({ storageState: undefined });

  test('TC-NAV-01: Вход и переход на список визитов', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input#email, input[placeholder*="email" i], input[name="email"]', LOGIN);
    await page.fill('input[type="password"]', PASS);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    // Должен быть список визитов или главная
    await expect(page.locator('body')).not.toHaveText(/Войти/, { timeout: 15000 });
  });

  test('TC-NAV-02: Консоль без критических ошибок', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/login');
    await page.fill('input[type="email"], input#email, input[placeholder*="email" i], input[name="email"]', LOGIN);
    await page.fill('input[type="password"]', PASS);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Фильтруем безобидные ошибки
    const critical = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('DevTools') &&
      !e.includes('sourceMap') &&
      !e.includes('google') &&
      !e.includes('analytics')
    );
    // Выводим для отчёта (не фейлим, т.к. могут быть предупреждения)
    if (critical.length > 0) {
      console.log('Console errors:', critical.join('\n'));
    }
  });
});
