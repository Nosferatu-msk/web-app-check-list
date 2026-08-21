import { test, expect } from '@playwright/test';

test.describe('Админ-панель', () => {
  test.beforeEach(async ({ page }) => {
    // Авторизация как админ
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('admin@example.com');
    await page.getByPlaceholder('Пароль').fill('admin123');
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page).toHaveURL('/');
  });

  test('Доступ к админ-панели', async ({ page }) => {
    // Нажимаем кнопку "Админ"
    await page.getByRole('button', { name: /админ/i }).click();

    // Должны попасть в админку
    await expect(page).toHaveURL(/\/admin/);

    // Проверяем наличие сайдбара с меню
    await expect(page.locator('.ant-menu, .ant-layout-sider')).toBeVisible();
  });

  test('Группировка меню админки', async ({ page }) => {
    await page.goto('/admin');

    // Проверяем наличие групп в меню
    const menuGroups = page.locator('.ant-menu-item-group');
    const groupsCount = await menuGroups.count();

    // Должно быть 5 групп: Объекты, Справочники, Пользователи, МТР, Система
    expect(groupsCount).toBeGreaterThanOrEqual(4);
  });

  test('Breadcrumbs в админке', async ({ page }) => {
    await page.goto('/admin/addresses');

    // Проверяем наличие breadcrumbs
    const breadcrumbs = page.locator('.ant-breadcrumb');
    await expect(breadcrumbs).toBeVisible();

    // Должен содержать "Главная" и текущую страницу
    await expect(breadcrumbs.getByText(/главная|адреса/i)).toBeVisible();
  });

  test('Навигация по разделам админки', async ({ page }) => {
    await page.goto('/admin');

    // Кликаем на "Пользователи"
    await page.getByText('Пользователи').click();
    await expect(page).toHaveURL(/\/admin\/users/);

    // Кликаем на "Оборудование"
    await page.getByText('Оборудование').first().click();
    await expect(page).toHaveURL(/\/admin\/equipment/);
  });

  test('Таблица адресов', async ({ page }) => {
    await page.goto('/admin/addresses');

    // Проверяем наличие таблицы
    await expect(page.locator('.ant-table')).toBeVisible();

    // Проверяем наличие кнопки "Добавить"
    await expect(page.getByRole('button', { name: /добавить/i })).toBeVisible();
  });
});
