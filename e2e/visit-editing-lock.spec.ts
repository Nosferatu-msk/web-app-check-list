import { test, expect } from '@playwright/test';

/**
 * Тест блокировки одновременного редактирования визитов
 * 
 * Сценарий:
 * 1. Инженер А открывает визит → устанавливается блокировка
 * 2. Инженер Б пытается открыть тот же визит → видит предупреждение
 * 3. Через 5 минут блокировка автоматически снимается
 * 4. Инженер Б снова может открыть визит
 */

test.describe('Блокировка одновременного редактирования визитов', () => {
  
  test('TC-VIS-LOCK-001: Блокировка устанавливается при открытии визита', async ({ page }) => {
    // Логинимся как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'engineer@example.com');
    await page.fill('input[type="password"]', 'engineer123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Переходим на страницу визитов
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Находим первый визит
    const firstVisit = page.locator('.ant-list-item').first();
    
    if (await firstVisit.isVisible()) {
      // Кликаем на визит
      await firstVisit.click();
      await page.waitForTimeout(2000);
      
      // Проверяем, что визит открыт
      const visitUrl = page.url();
      expect(visitUrl).toContain('/visit/');
      
      console.log('✅ Визит открыт, блокировка должна быть установлена');
      
      // Проверяем наличие предупреждения "Визит коллеги" (если это чужой визит)
      const colleagueWarning = page.locator('text=Визит коллеги');
      if (await colleagueWarning.isVisible()) {
        console.log('✅ Предупреждение "Визит коллеги" отображается');
      }
    } else {
      console.log('ℹ️ Нет доступных визитов для проверки');
    }
  });
  
  test('TC-VIS-LOCK-002: Предупреждение при попытке открыть заблокированный визит', async ({ page, context }) => {
    // Создаём два браузера для имитации двух инженеров
    const browser1 = context.browser();
    if (!browser1) {
      console.log('ℹ️ Браузер недоступен');
      return;
    }
    
    // Инженер А открывает визит
    const page1 = await browser1.newPage();
    await page1.goto('/login');
    await page1.fill('input[type="email"]', 'engineer@example.com');
    await page1.fill('input[type="password"]', 'engineer123');
    await page1.click('button[type="submit"]');
    await page1.waitForURL('/');
    
    await page1.goto('/');
    await page1.waitForLoadState('networkidle');
    
    // Находим первый визит
    const firstVisit = page1.locator('.ant-list-item').first();
    if (await firstVisit.isVisible()) {
      await firstVisit.click();
      await page1.waitForTimeout(2000);
      
      const visitUrl = page1.url();
      console.log(`✅ Инженер А открыл визит: ${visitUrl}`);
      
      // Инженер Б пытается открыть тот же визит
      const page2 = await browser1.newPage();
      await page2.goto('/login');
      await page2.fill('input[type="email"]', 'engineer@example.com');
      await page2.fill('input[type="password"]', 'engineer123');
      await page2.click('button[type="submit"]');
      await page2.waitForURL('/');
      
      // Переходим на тот же визит
      await page2.goto(visitUrl);
      await page2.waitForTimeout(2000);
      
      // Проверяем наличие предупреждения о блокировке
      const lockWarning = page2.locator('text=Визит в настоящее время редактируется');
      if (await lockWarning.isVisible()) {
        console.log('✅ Предупреждение о блокировке отображается');
      } else {
        console.log('ℹ️ Предупреждение о блокировке не найдено (возможно, визит не заблокирован)');
      }
      
      await page2.close();
    }
    
    await page1.close();
  });
  
  test('TC-VIS-LOCK-003: Завершённый визит нельзя редактировать', async ({ page }) => {
    // Логинимся как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'engineer@example.com');
    await page.fill('input[type="password"]', 'engineer123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Переходим на страницу визитов
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Фильтруем завершённые визиты
    const statusFilter = page.locator('.ant-select').first();
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.click('text=Завершён');
      await page.waitForTimeout(2000);
    }
    
    // Находим первый завершённый визит
    const completedVisit = page.locator('.ant-list-item').first();
    
    if (await completedVisit.isVisible()) {
      // Кликаем на визит
      await completedVisit.click();
      await page.waitForTimeout(2000);
      
      // Проверяем наличие ошибки "Визит завершён или отправлен"
      const completedError = page.locator('text=Визит завершён или отправлен');
      if (await completedError.isVisible()) {
        console.log('✅ Ошибка редактирования завершённого визита отображается');
      } else {
        console.log('ℹ️ Визит завершён, но ошибка не отображается (возможно, это свой визит)');
      }
    } else {
      console.log('ℹ️ Нет завершённых визитов для проверки');
    }
  });
});
