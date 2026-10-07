import { test, expect } from '@playwright/test';

/**
 * Расширенные тесты авторизации
 * 
 * Роли:
 * - Инженер: testic@test.ru / testic123
 * - ТМ: test_tm_ca@test.ru / test_tm_ca123
 * - Админ: ipbaydachenko@mail.ru / admin123
 * 
 * Тестовые объекты: CA/*
 */

test.describe('Авторизация — расширенные тесты', () => {
  
  // ═══════════════════════════════════════════════════════════════
  // БАЗОВАЯ АВТОРИЗАЦИЯ
  // ═══════════════════════════════════════════════════════════════
  
  test('TC-AUTH-001: Вход инженера (testic@test.ru)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Проверяем успешный вход
    await expect(page.locator('text=Мои визиты')).toBeVisible();
    await expect(page.locator('text=testic')).toBeVisible();
    
    console.log('✅ Инженер успешно вошёл');
  });
  
  test('TC-AUTH-002: Вход ТМ (test_tm_ca@test.ru)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
    await page.fill('input[type="password"]', 'test_tm_ca123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Проверяем успешный вход
    await expect(page.locator('text=Мои визиты')).toBeVisible();
    
    console.log('✅ ТМ успешно вошёл');
  });
  
  test('TC-AUTH-003: Вход админа (ipbaydachenko@mail.ru)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'ipbaydachenko@mail.ru');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Проверяем успешный вход
    await expect(page.locator('text=Мои визиты')).toBeVisible();
    await expect(page.locator('button:has-text("Админ")')).toBeVisible();
    
    console.log('✅ Админ успешно вошёл');
  });
  
  test('TC-AUTH-004: Неверный пароль', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Проверяем ошибку
    await expect(page.locator('text=Неверный email или пароль')).toBeVisible();
    await expect(page.url()).toContain('/login');
    
    console.log('✅ Ошибка неверного пароля отображается');
  });
  
  test('TC-AUTH-005: Пустые поля при входе', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    
    // Проверяем валидацию
    await expect(page.url()).toContain('/login');
    
    console.log('✅ Валидация пустых полей работает');
  });
  
  test('TC-AUTH-006: Регистронезависимый вход (uppercase)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'TESTIC@TEST.RU');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Проверяем успешный вход
    await expect(page.locator('text=Мои визиты')).toBeVisible();
    
    console.log('✅ Регистронезависимый вход работает (uppercase)');
  });
  
  test('TC-AUTH-007: Регистронезависимый вход (mixed case)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'TeStIc@TeSt.Ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Проверяем успешный вход
    await expect(page.locator('text=Мои визиты')).toBeVisible();
    
    console.log('✅ Регистронезависимый вход работает (mixed case)');
  });
  
  test('TC-AUTH-008: Выход из системы', async ({ page }) => {
    // Входим
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Выходим
    await page.click('button:has-text("Выход")');
    await page.waitForURL('/login');
    
    // Проверяем, что вышли
    await expect(page.locator('text=Войти')).toBeVisible();
    
    console.log('✅ Выход из системы работает');
  });
  
  test('TC-AUTH-009: Доступ к защищённой странице без авторизации', async ({ page }) => {
    // Пытаемся открыть защищённую страницу
    await page.goto('/');
    
    // Должны перенаправить на логин
    await page.waitForURL('/login');
    await expect(page.locator('text=Войти')).toBeVisible();
    
    console.log('✅ Защищённая страница перенаправляет на логин');
  });
  
  test('TC-AUTH-010: Сохранение сессии после обновления страницы', async ({ page }) => {
    // Входим
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Обновляем страницу
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Проверяем, что сессия сохранилась
    await expect(page.locator('text=Мои визиты')).toBeVisible();
    await expect(page.locator('text=testic')).toBeVisible();
    
    console.log('✅ Сессия сохраняется после обновления страницы');
  });
});
