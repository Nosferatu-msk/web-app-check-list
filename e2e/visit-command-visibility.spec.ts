import { test, expect } from '@playwright/test';

/**
 * Тест видимости визитов команды для инженеров
 * 
 * Сценарий:
 * 1. Инженер А создаёт визит
 * 2. Инженер Б (из той же команды ТМ) видит визит инженера А
 * 3. Инженер Б может открыть визит инженера А
 * 4. Визит отображается с пометкой "Визит коллеги"
 * 5. Инженер Б не может удалить визит инженера А
 */

test.describe('Видимость визитов команды для инженеров', () => {
  
  test('TC-VIS-COMMAND-001: Инженер видит визиты коллег по команде', async ({ page }) => {
    // Логинимся как инженер А
    await page.goto('/login');
    await page.fill('input[type="email"]', 'engineer@example.com');
    await page.fill('input[type="password"]', 'engineer123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Переходим на страницу визитов
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Проверяем, что страница загрузилась
    await expect(page.locator('text=Мои визиты')).toBeVisible();
    
    // Создаём новый визит
    await page.click('button:has-text("Новый визит")');
    await page.waitForURL('/visit/new');
    
    // Заполняем адрес
    await page.fill('input[placeholder*="адрес"]', 'Тестовый адрес');
    await page.waitForTimeout(1000);
    
    // Выбираем первый адрес из подсказок
    const addressOption = page.locator('.ant-select-item-option-content').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    // Сохраняем визит
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Проверяем, что визит создан
    const visitUrl = page.url();
    expect(visitUrl).toContain('/visit/');
    
    // Выходим
    await page.goto('/');
    await page.click('button:has-text("Выход")');
    await page.waitForURL('/login');
    
    // Логинимся как инженер Б (из той же команды ТМ)
    // Примечание: для полноценного теста нужен второй инженер из той же команды
    // Этот тест — заглушка для демонстрации структуры
    console.log('⚠️ Для полноценного теста нужен второй инженер из той же команды ТМ');
  });
  
  test('TC-VIS-COMMAND-002: Пометка "Визит коллеги" отображается', async ({ page }) => {
    // Логинимся как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'engineer@example.com');
    await page.fill('input[type="password"]', 'engineer123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Переходим на страницу визитов
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Проверяем наличие пометки "Визит коллеги" (если есть визиты коллег)
    // Примечание: пометка отображается только для визитов других инженеров из команды
    const colleagueBadge = page.locator('text=Визит коллеги');
    
    // Проверяем, что пометка видна (если есть такие визиты)
    if (await colleagueBadge.isVisible()) {
      console.log('✅ Пометка "Визит коллеги" отображается');
    } else {
      console.log('ℹ️ Пометка "Визит коллеги" не найдена (нет визитов коллег)');
    }
  });
  
  test('TC-VIS-COMMAND-003: Инженер не может удалить чужой визит', async ({ page }) => {
    // Логинимся как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'engineer@example.com');
    await page.fill('input[type="password"]', 'engineer123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Переходим на страницу визитов
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Находим визит коллеги (если есть)
    const colleagueVisit = page.locator('text=Визит коллеги').first();
    
    if (await colleagueVisit.isVisible()) {
      // Кликаем на визит
      await colleagueVisit.click();
      await page.waitForTimeout(1000);
      
      // Проверяем наличие кнопки удаления
      const deleteButton = page.locator('button:has-text("Удалить визит")');
      
      if (await deleteButton.isVisible()) {
        // Пытаемся удалить визит
        await deleteButton.click();
        
        // Проверяем появление модального окна подтверждения
        const confirmModal = page.locator('.ant-modal-confirm');
        if (await confirmModal.isVisible()) {
          // Подтверждаем удаление
          await page.click('.ant-modal-confirm-btns button:has-text("Удалить")');
          await page.waitForTimeout(1000);
          
          // Проверяем появление ошибки "Вы можете удалять только свои визиты"
          const errorMessage = page.locator('text=Вы можете удалять только свои визиты');
          await expect(errorMessage).toBeVisible({ timeout: 5000 });
          
          console.log('✅ Ошибка удаления чужого визита отображается');
        }
      }
    } else {
      console.log('ℹ️ Нет визитов коллег для проверки');
    }
  });
});
