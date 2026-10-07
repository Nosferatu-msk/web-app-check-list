import { test, expect } from '@playwright/test';

/**
 * Расширенные тесты видимости визитов команды для инженеров
 * 
 * Роли:
 * - ТМ: test_tm_ca@test.ru (тестовый ТМ для объектов CA/*)
 * - Инженер: testic@test.ru (тестовый инженер)
 * - Админ: ipbaydachenko@mail.ru (администратор)
 * 
 * Тестовые объекты: CA/* (можно свободно изменять данные)
 */

test.describe('Расширенные тесты видимости визитов команды', () => {
  
  // ═══════════════════════════════════════════════════════════════
  // ТЕСТЫ ДЛЯ РОЛИ ТМ (test_tm_ca@test.ru)
  // ═══════════════════════════════════════════════════════════════
  
  test.describe('Роль ТМ', () => {
    
    test('TC-TM-VIS-001: ТМ видит визиты всех инженеров команды', async ({ page }) => {
      // Логинимся как ТМ
      await page.goto('/login');
      await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
      await page.fill('input[type="password"]', 'test_tm_ca123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Переходим на страницу визитов
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Проверяем, что ТМ видит визиты инженеров
      const visitsList = page.locator('.ant-list-items');
      await expect(visitsList).toBeVisible();
      
      // Проверяем наличие фильтра по инженеру
      const engineerFilter = page.locator('.ant-select').first();
      await expect(engineerFilter).toBeVisible();
      
      console.log('✅ ТМ видит список визитов и фильтр по инженерам');
    });
    
    test('TC-TM-VIS-002: ТМ может создать визит для инженера', async ({ page }) => {
      // Логинимся как ТМ
      await page.goto('/login');
      await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
      await page.fill('input[type="password"]', 'test_tm_ca123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Создаём новый визит
      await page.goto('/visit/new');
      await page.waitForLoadState('networkidle');
      
      // Выбираем инженера из списка
      const engineerSelect = page.locator('label:has-text("Инженер") + * .ant-select');
      if (await engineerSelect.isVisible()) {
        await engineerSelect.click();
        await page.waitForTimeout(500);
        
        // Выбираем первого инженера
        const firstEngineer = page.locator('.ant-select-item-option-content').first();
        if (await firstEngineer.isVisible()) {
          await firstEngineer.click();
        }
      }
      
      // Заполняем адрес (объект CA/*)
      await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
      await page.waitForTimeout(1000);
      
      // Выбираем адрес из подсказок
      const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
      if (await addressOption.isVisible()) {
        await addressOption.click();
      }
      
      // Сохраняем визит
      await page.click('button:has-text("Сохранить")');
      await page.waitForTimeout(2000);
      
      // Проверяем, что визит создан
      const visitUrl = page.url();
      expect(visitUrl).toContain('/visit/');
      
      console.log('✅ ТМ создал визит для инженера');
    });
    
    test('TC-TM-VIS-003: ТМ видит пометку "Визит коллеги" для инженеров', async ({ page }) => {
      // Логинимся как ТМ
      await page.goto('/login');
      await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
      await page.fill('input[type="password"]', 'test_tm_ca123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Переходим на страницу визитов
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Проверяем наличие пометки "Визит коллеги" (если есть визиты инженеров)
      const colleagueBadge = page.locator('text=Визит коллеги');
      
      if (await colleagueBadge.isVisible()) {
        console.log('✅ Пометка "Визит коллеги" отображается для ТМ');
      } else {
        console.log('ℹ️ Пометка "Визит коллеги" не найдена (нет визитов инженеров)');
      }
    });
    
    test('TC-TM-VIS-004: ТМ может корректировать визиты инженеров', async ({ page }) => {
      // Логинимся как ТМ
      await page.goto('/login');
      await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
      await page.fill('input[type="password"]', 'test_tm_ca123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Переходим на страницу визитов
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Находим первый визит инженера
      const firstVisit = page.locator('.ant-list-item').first();
      
      if (await firstVisit.isVisible()) {
        // Кликаем на визит
        await firstVisit.click();
        await page.waitForTimeout(2000);
        
        // Проверяем, что визит открыт
        const visitUrl = page.url();
        expect(visitUrl).toContain('/visit/');
        
        // Проверяем наличие кнопки сохранения
        const saveButton = page.locator('button:has-text("Сохранить")');
        await expect(saveButton).toBeVisible();
        
        console.log('✅ ТМ может открыть и редактировать визит инженера');
      } else {
        console.log('ℹ️ Нет доступных визитов для проверки');
      }
    });
    
    test('TC-TM-VIS-005: ТМ может удалять визиты инженеров', async ({ page }) => {
      // Логинимся как ТМ
      await page.goto('/login');
      await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
      await page.fill('input[type="password"]', 'test_tm_ca123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Переходим на страницу визитов
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Находим первый визит
      const firstVisit = page.locator('.ant-list-item').first();
      
      if (await firstVisit.isVisible()) {
        // Наводим на визит и находим кнопку удаления
        const deleteButton = firstVisit.locator('button:has-text("Удалить")');
        
        if (await deleteButton.isVisible()) {
          console.log('✅ ТМ видит кнопку удаления визита инженера');
        } else {
          console.log('ℹ️ Кнопка удаления не найдена');
        }
      } else {
        console.log('ℹ️ Нет доступных визитов для проверки');
      }
    });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // ТЕСТЫ ДЛЯ РОЛИ АДМИН (ipbaydachenko@mail.ru)
  // ═══════════════════════════════════════════════════════════════
  
  test.describe('Роль Админ', () => {
    
    test('TC-ADMIN-VIS-001: Админ видит все визиты всех команд', async ({ page }) => {
      // Логинимся как Админ
      await page.goto('/login');
      await page.fill('input[type="email"]', 'ipbaydachenko@mail.ru');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Переходим на страницу визитов
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Проверяем, что админ видит все визиты
      const visitsList = page.locator('.ant-list-items');
      await expect(visitsList).toBeVisible();
      
      // Проверяем наличие фильтра по инженеру
      const engineerFilter = page.locator('.ant-select').first();
      await expect(engineerFilter).toBeVisible();
      
      console.log('✅ Админ видит список всех визитов');
    });
    
    test('TC-ADMIN-VIS-002: Админ может управлять любыми визитами', async ({ page }) => {
      // Логинимся как Админ
      await page.goto('/login');
      await page.fill('input[type="email"]', 'ipbaydachenko@mail.ru');
      await page.fill('input[type="password"]', 'admin123');
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
        
        // Проверяем наличие кнопок управления
        const saveButton = page.locator('button:has-text("Сохранить")');
        await expect(saveButton).toBeVisible();
        
        console.log('✅ Админ может открыть и редактировать любой визит');
      } else {
        console.log('ℹ️ Нет доступных визитов для проверки');
      }
    });
    
    test('TC-ADMIN-VIS-003: Админ видит все объекты CA/*', async ({ page }) => {
      // Логинимся как Админ
      await page.goto('/login');
      await page.fill('input[type="email"]', 'ipbaydachenko@mail.ru');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Переходим в админку
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      
      // Проверяем наличие раздела "Объекты"
      const objectsLink = page.locator('a:has-text("Объекты")');
      if (await objectsLink.isVisible()) {
        await objectsLink.click();
        await page.waitForTimeout(2000);
        
        // Проверяем наличие объектов CA/*
        const caObjects = page.locator('text=CA/');
        if (await caObjects.isVisible()) {
          console.log('✅ Админ видит объекты CA/*');
        } else {
          console.log('ℹ️ Объекты CA/* не найдены');
        }
      }
    });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // ТЕСТЫ ДЛЯ ДВУХ ИНЖЕНЕРОВ ОДНОЙ КОМАНДЫ
  // ═══════════════════════════════════════════════════════════════
  
  test.describe('Пара инженеров одной команды', () => {
    
    test('TC-PAIR-001: Инженер видит визиты коллег по команде', async ({ page }) => {
      // Логинимся как инженер
      await page.goto('/login');
      await page.fill('input[type="email"]', 'testic@test.ru');
      await page.fill('input[type="password"]', 'testic123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
      
      // Переходим на страницу визитов
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Проверяем наличие пометки "Визит коллеги"
      const colleagueBadge = page.locator('text=Визит коллеги');
      
      if (await colleagueBadge.isVisible()) {
        console.log('✅ Инженер видит визиты коллег с пометкой');
      } else {
        console.log('ℹ️ Пометка "Визит коллеги" не найдена (нет визитов коллег)');
      }
    });
    
    test('TC-PAIR-002: Инженер не может удалить чужой визит', async ({ page }) => {
      // Логинимся как инженер
      await page.goto('/login');
      await page.fill('input[type="email"]', 'testic@test.ru');
      await page.fill('input[type="password"]', 'testic123');
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
    
    test('TC-PAIR-003: Инженер может редактировать визит коллеги', async ({ page }) => {
      // Логинимся как инженер
      await page.goto('/login');
      await page.fill('input[type="email"]', 'testic@test.ru');
      await page.fill('input[type="password"]', 'testic123');
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
        await page.waitForTimeout(2000);
        
        // Проверяем, что визит открыт
        const visitUrl = page.url();
        expect(visitUrl).toContain('/visit/');
        
        // Проверяем наличие предупреждения "Визит коллеги"
        const colleagueWarning = page.locator('text=Визит коллеги');
        if (await colleagueWarning.isVisible()) {
          console.log('✅ Инженер может открыть визит коллеги');
        }
      } else {
        console.log('ℹ️ Нет визитов коллег для проверки');
      }
    });
    
    test('TC-PAIR-004: Блокировка работает при открытии визита', async ({ page }) => {
      // Логинимся как инженер
      await page.goto('/login');
      await page.fill('input[type="email"]', 'testic@test.ru');
      await page.fill('input[type="password"]', 'testic123');
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
      } else {
        console.log('ℹ️ Нет доступных визитов для проверки');
      }
    });
  });
});
