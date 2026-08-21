import { test, expect } from '@playwright/test';

test.describe('Админ-панель', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Пароль').fill('admin123');
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.waitForURL(/\/(visit|mtr|profile|admin)?/, { timeout: 10000 });
  });

  test('Доступ к админ-панели', async ({ page }) => {
    // Находим кнопку "Админ" и кликаем
    const adminButton = page.getByRole('button', { name: /админ/i });
    if (await adminButton.isVisible()) {
      await adminButton.click();
      await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
    } else {
      // Переходим напрямую
      await page.goto('/admin');
    }

    // Проверяем наличие меню
    await expect(page.locator('.ant-menu').first()).toBeVisible({ timeout: 5000 });
  });

  test('Группировка меню админки', async ({ page }) => {
    await page.goto('/admin');

    // Проверяем наличие групп в меню
    const menuGroups = page.locator('.ant-menu-item-group-title');
    const groupsCount = await menuGroups.count();

    // Должно быть минимум 4 группы
    expect(groupsCount).toBeGreaterThanOrEqual(4);
  });

  test('Breadcrumbs в админке', async ({ page }) => {
    await page.goto('/admin/addresses');

    // Проверяем наличие breadcrumbs
    const breadcrumbs = page.locator('.ant-breadcrumb');
    await expect(breadcrumbs).toBeVisible({ timeout: 5000 });
  });

  test('Таблица адресов', async ({ page }) => {
    await page.goto('/admin/addresses');

    // Проверяем наличие таблицы
    await expect(page.locator('.ant-table').first()).toBeVisible({ timeout: 5000 });
  });
});
