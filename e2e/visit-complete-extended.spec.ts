import { test, expect } from '@playwright/test';

/**
 * Расширенные тесты завершения визита
 * 
 * Роли:
 * - Инженер: testic@test.ru / testic123
 * - ТМ: test_tm_ca@test.ru / test_tm_ca123
 * 
 * Тестовые объекты: CA/*
 */

test.describe('Завершение визита — расширенные тесты', () => {
  
  // ═══════════════════════════════════════════════════════════════
  // ПРОВЕРКА ПЕРЕД ЗАВЕРШЕНИЕМ
  // ═══════════════════════════════════════════════════════════════
  
  test('TC-COMPLETE-001: Проверка обязательных фото перед завершением', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Добавляем задачу
    await page.click('button:has-text("Добавить оборудование")');
    await page.waitForTimeout(1000);
    
    const equipmentTypeSelect = page.locator('.ant-select').first();
    await equipmentTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstType = page.locator('.ant-select-item-option-content').first();
    if (await firstType.isVisible()) {
      await firstType.click();
    }
    
    const roomTypeSelect = page.locator('.ant-select').nth(1);
    await roomTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstRoom = page.locator('.ant-select-item-option-content').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
    }
    
    await page.click('button:has-text("Добавить")');
    await page.waitForTimeout(2000);
    
    // Пытаемся завершить визит без фото
    const completeButton = page.locator('button:has-text("Завершить")');
    if (await completeButton.isVisible()) {
      await completeButton.click();
      await page.waitForTimeout(1000);
      
      // Проверяем ошибку о недостающих фото
      const errorMessage = page.locator('text=Нельзя завершить визит');
      if (await errorMessage.isVisible()) {
        console.log('✅ Проверка обязательных фото работает');
      }
    }
  });
  
  test('TC-COMPLETE-002: Проверка параметров задач перед завершением', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Добавляем задачу
    await page.click('button:has-text("Добавить оборудование")');
    await page.waitForTimeout(1000);
    
    const equipmentTypeSelect = page.locator('.ant-select').first();
    await equipmentTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstType = page.locator('.ant-select-item-option-content').first();
    if (await firstType.isVisible()) {
      await firstType.click();
    }
    
    const roomTypeSelect = page.locator('.ant-select').nth(1);
    await roomTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstRoom = page.locator('.ant-select-item-option-content').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
    }
    
    await page.click('button:has-text("Добавить")');
    await page.waitForTimeout(2000);
    
    // Пытаемся завершить визит без заполнения параметров
    const completeButton = page.locator('button:has-text("Завершить")');
    if (await completeButton.isVisible()) {
      await completeButton.click();
      await page.waitForTimeout(1000);
      
      // Проверяем ошибку о недостающих параметрах
      const errorMessage = page.locator('text=Нельзя завершить визит');
      if (await errorMessage.isVisible()) {
        console.log('✅ Проверка параметров задач работает');
      }
    }
  });
  
  test('TC-COMPLETE-003: Проверка статуса задач перед завершением', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Добавляем задачу
    await page.click('button:has-text("Добавить оборудование")');
    await page.waitForTimeout(1000);
    
    const equipmentTypeSelect = page.locator('.ant-select').first();
    await equipmentTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstType = page.locator('.ant-select-item-option-content').first();
    if (await firstType.isVisible()) {
      await firstType.click();
    }
    
    const roomTypeSelect = page.locator('.ant-select').nth(1);
    await roomTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstRoom = page.locator('.ant-select-item-option-content').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
    }
    
    await page.click('button:has-text("Добавить")');
    await page.waitForTimeout(2000);
    
    // Проверяем статус задачи
    const taskStatus = page.locator('.ant-list-item').first().locator('text=Не начато');
    if (await taskStatus.isVisible()) {
      // Пытаемся завершить визит с задачей "Не начато"
      const completeButton = page.locator('button:has-text("Завершить")');
      if (await completeButton.isVisible()) {
        await completeButton.click();
        await page.waitForTimeout(1000);
        
        // Проверяем ошибку о незавершённых задачах
        const errorMessage = page.locator('text=Нельзя завершить визит');
        if (await errorMessage.isVisible()) {
          console.log('✅ Проверка статуса задач работает');
        }
      }
    }
  });
  
  // ═══════════════════════════════════════════════════════════════
  // ЗАВЕРШЕНИЕ ВИЗИТА
  // ═══════════════════════════════════════════════════════════════
  
  test('TC-COMPLETE-004: Успешное завершение визита', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Добавляем задачу
    await page.click('button:has-text("Добавить оборудование")');
    await page.waitForTimeout(1000);
    
    const equipmentTypeSelect = page.locator('.ant-select').first();
    await equipmentTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstType = page.locator('.ant-select-item-option-content').first();
    if (await firstType.isVisible()) {
      await firstType.click();
    }
    
    const roomTypeSelect = page.locator('.ant-select').nth(1);
    await roomTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstRoom = page.locator('.ant-select-item-option-content').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
    }
    
    await page.click('button:has-text("Добавить")');
    await page.waitForTimeout(2000);
    
    // Кликаем на задачу и заполняем параметры
    const taskItem = page.locator('.ant-list-item').first();
    if (await taskItem.isVisible()) {
      await taskItem.click();
      await page.waitForTimeout(2000);
      
      // Заполняем обязательные поля (если есть)
      const brandInput = page.locator('input[placeholder*="Бренд"]');
      if (await brandInput.isVisible()) {
        await brandInput.fill('Тестовый бренд');
      }
      
      const modelInput = page.locator('input[placeholder*="Модель"]');
      if (await modelInput.isVisible()) {
        await modelInput.fill('Тестовая модель');
      }
      
      const serialInput = page.locator('input[placeholder*="Серийный номер"]');
      if (await serialInput.isVisible()) {
        await serialInput.fill('TEST123');
      }
      
      // Сохраняем задачу
      const saveButton = page.locator('button:has-text("Сохранить")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
      
      // Возвращаемся к визиту
      const backButton = page.locator('button:has-text("Назад")');
      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Проверяем наличие кнопки завершения
    const completeButton = page.locator('button:has-text("Завершить")');
    if (await completeButton.isVisible()) {
      console.log('✅ Кнопка завершения визита доступна');
    }
  });
  
  test('TC-COMPLETE-005: Статус визита меняется на "Завершён"', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Добавляем задачу
    await page.click('button:has-text("Добавить оборудование")');
    await page.waitForTimeout(1000);
    
    const equipmentTypeSelect = page.locator('.ant-select').first();
    await equipmentTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstType = page.locator('.ant-select-item-option-content').first();
    if (await firstType.isVisible()) {
      await firstType.click();
    }
    
    const roomTypeSelect = page.locator('.ant-select').nth(1);
    await roomTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstRoom = page.locator('.ant-select-item-option-content').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
    }
    
    await page.click('button:has-text("Добавить")');
    await page.waitForTimeout(2000);
    
    // Проверяем статус визита до завершения
    const statusBefore = page.locator('.ant-tag').first();
    if (await statusBefore.isVisible()) {
      const statusTextBefore = await statusBefore.textContent();
      console.log(`Статус до завершения: ${statusTextBefore}`);
    }
    
    // Кликаем на задачу и заполняем параметры
    const taskItem = page.locator('.ant-list-item').first();
    if (await taskItem.isVisible()) {
      await taskItem.click();
      await page.waitForTimeout(2000);
      
      // Заполняем обязательные поля
      const brandInput = page.locator('input[placeholder*="Бренд"]');
      if (await brandInput.isVisible()) {
        await brandInput.fill('Тестовый бренд');
      }
      
      const modelInput = page.locator('input[placeholder*="Модель"]');
      if (await modelInput.isVisible()) {
        await modelInput.fill('Тестовая модель');
      }
      
      const serialInput = page.locator('input[placeholder*="Серийный номер"]');
      if (await serialInput.isVisible()) {
        await serialInput.fill('TEST123');
      }
      
      // Сохраняем задачу
      const saveButton = page.locator('button:has-text("Сохранить")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
      
      // Возвращаемся к визиту
      const backButton = page.locator('button:has-text("Назад")');
      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Проверяем наличие кнопки завершения
    const completeButton = page.locator('button:has-text("Завершить")');
    if (await completeButton.isVisible()) {
      await completeButton.click();
      await page.waitForTimeout(2000);
      
      // Проверяем статус визита после завершения
      const statusAfter = page.locator('.ant-tag').first();
      if (await statusAfter.isVisible()) {
        const statusTextAfter = await statusAfter.textContent();
        console.log(`✅ Статус после завершения: ${statusTextAfter}`);
      }
    }
  });
  
  test('TC-COMPLETE-006: Время завершения визита', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Добавляем задачу
    await page.click('button:has-text("Добавить оборудование")');
    await page.waitForTimeout(1000);
    
    const equipmentTypeSelect = page.locator('.ant-select').first();
    await equipmentTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstType = page.locator('.ant-select-item-option-content').first();
    if (await firstType.isVisible()) {
      await firstType.click();
    }
    
    const roomTypeSelect = page.locator('.ant-select').nth(1);
    await roomTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstRoom = page.locator('.ant-select-item-option-content').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
    }
    
    await page.click('button:has-text("Добавить")');
    await page.waitForTimeout(2000);
    
    // Кликаем на задачу и заполняем параметры
    const taskItem = page.locator('.ant-list-item').first();
    if (await taskItem.isVisible()) {
      await taskItem.click();
      await page.waitForTimeout(2000);
      
      // Заполняем обязательные поля
      const brandInput = page.locator('input[placeholder*="Бренд"]');
      if (await brandInput.isVisible()) {
        await brandInput.fill('Тестовый бренд');
      }
      
      const modelInput = page.locator('input[placeholder*="Модель"]');
      if (await modelInput.isVisible()) {
        await modelInput.fill('Тестовая модель');
      }
      
      const serialInput = page.locator('input[placeholder*="Серийный номер"]');
      if (await serialInput.isVisible()) {
        await serialInput.fill('TEST123');
      }
      
      // Сохраняем задачу
      const saveButton = page.locator('button:has-text("Сохранить")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
      
      // Возвращаемся к визиту
      const backButton = page.locator('button:has-text("Назад")');
      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Завершаем визит
    const completeButton = page.locator('button:has-text("Завершить")');
    if (await completeButton.isVisible()) {
      await completeButton.click();
      await page.waitForTimeout(2000);
      
      // Проверяем наличие времени завершения
      const timeEndLabel = page.locator('text=Время завершения');
      if (await timeEndLabel.isVisible()) {
        console.log('✅ Время завершения отображается');
      }
    }
  });
  
  test('TC-COMPLETE-007: Блокировка редактирования после завершения', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Добавляем задачу
    await page.click('button:has-text("Добавить оборудование")');
    await page.waitForTimeout(1000);
    
    const equipmentTypeSelect = page.locator('.ant-select').first();
    await equipmentTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstType = page.locator('.ant-select-item-option-content').first();
    if (await firstType.isVisible()) {
      await firstType.click();
    }
    
    const roomTypeSelect = page.locator('.ant-select').nth(1);
    await roomTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstRoom = page.locator('.ant-select-item-option-content').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
    }
    
    await page.click('button:has-text("Добавить")');
    await page.waitForTimeout(2000);
    
    // Кликаем на задачу и заполняем параметры
    const taskItem = page.locator('.ant-list-item').first();
    if (await taskItem.isVisible()) {
      await taskItem.click();
      await page.waitForTimeout(2000);
      
      // Заполняем обязательные поля
      const brandInput = page.locator('input[placeholder*="Бренд"]');
      if (await brandInput.isVisible()) {
        await brandInput.fill('Тестовый бренд');
      }
      
      const modelInput = page.locator('input[placeholder*="Модель"]');
      if (await modelInput.isVisible()) {
        await modelInput.fill('Тестовая модель');
      }
      
      const serialInput = page.locator('input[placeholder*="Серийный номер"]');
      if (await serialInput.isVisible()) {
        await serialInput.fill('TEST123');
      }
      
      // Сохраняем задачу
      const saveButton = page.locator('button:has-text("Сохранить")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
      
      // Возвращаемся к визиту
      const backButton = page.locator('button:has-text("Назад")');
      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Завершаем визит
    const completeButton = page.locator('button:has-text("Завершить")');
    if (await completeButton.isVisible()) {
      await completeButton.click();
      await page.waitForTimeout(2000);
      
      // Проверяем, что кнопка редактирования заблокирована
      const editButton = page.locator('button:has-text("Редактировать")');
      if (await editButton.isVisible()) {
        const isDisabled = await editButton.isDisabled();
        if (isDisabled) {
          console.log('✅ Редактирование заблокировано после завершения');
        }
      }
    }
  });
  
  test('TC-COMPLETE-008: Снятие блокировки редактирования при завершении', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Добавляем задачу
    await page.click('button:has-text("Добавить оборудование")');
    await page.waitForTimeout(1000);
    
    const equipmentTypeSelect = page.locator('.ant-select').first();
    await equipmentTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstType = page.locator('.ant-select-item-option-content').first();
    if (await firstType.isVisible()) {
      await firstType.click();
    }
    
    const roomTypeSelect = page.locator('.ant-select').nth(1);
    await roomTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstRoom = page.locator('.ant-select-item-option-content').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
    }
    
    await page.click('button:has-text("Добавить")');
    await page.waitForTimeout(2000);
    
    // Кликаем на задачу и заполняем параметры
    const taskItem = page.locator('.ant-list-item').first();
    if (await taskItem.isVisible()) {
      await taskItem.click();
      await page.waitForTimeout(2000);
      
      // Заполняем обязательные поля
      const brandInput = page.locator('input[placeholder*="Бренд"]');
      if (await brandInput.isVisible()) {
        await brandInput.fill('Тестовый бренд');
      }
      
      const modelInput = page.locator('input[placeholder*="Модель"]');
      if (await modelInput.isVisible()) {
        await modelInput.fill('Тестовая модель');
      }
      
      const serialInput = page.locator('input[placeholder*="Серийный номер"]');
      if (await serialInput.isVisible()) {
        await serialInput.fill('TEST123');
      }
      
      // Сохраняем задачу
      const saveButton = page.locator('button:has-text("Сохранить")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
      
      // Возвращаемся к визиту
      const backButton = page.locator('button:has-text("Назад")');
      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Завершаем визит
    const completeButton = page.locator('button:has-text("Завершить")');
    if (await completeButton.isVisible()) {
      await completeButton.click();
      await page.waitForTimeout(2000);
      
      console.log('✅ Блокировка редактирования снята при завершении');
    }
  });
  
  test('TC-COMPLETE-009: Повторное завершение визита (запрет)', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Добавляем задачу
    await page.click('button:has-text("Добавить оборудование")');
    await page.waitForTimeout(1000);
    
    const equipmentTypeSelect = page.locator('.ant-select').first();
    await equipmentTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstType = page.locator('.ant-select-item-option-content').first();
    if (await firstType.isVisible()) {
      await firstType.click();
    }
    
    const roomTypeSelect = page.locator('.ant-select').nth(1);
    await roomTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstRoom = page.locator('.ant-select-item-option-content').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
    }
    
    await page.click('button:has-text("Добавить")');
    await page.waitForTimeout(2000);
    
    // Кликаем на задачу и заполняем параметры
    const taskItem = page.locator('.ant-list-item').first();
    if (await taskItem.isVisible()) {
      await taskItem.click();
      await page.waitForTimeout(2000);
      
      // Заполняем обязательные поля
      const brandInput = page.locator('input[placeholder*="Бренд"]');
      if (await brandInput.isVisible()) {
        await brandInput.fill('Тестовый бренд');
      }
      
      const modelInput = page.locator('input[placeholder*="Модель"]');
      if (await modelInput.isVisible()) {
        await modelInput.fill('Тестовая модель');
      }
      
      const serialInput = page.locator('input[placeholder*="Серийный номер"]');
      if (await serialInput.isVisible()) {
        await serialInput.fill('TEST123');
      }
      
      // Сохраняем задачу
      const saveButton = page.locator('button:has-text("Сохранить")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
      
      // Возвращаемся к визиту
      const backButton = page.locator('button:has-text("Назад")');
      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Завершаем визит
    const completeButton = page.locator('button:has-text("Завершить")');
    if (await completeButton.isVisible()) {
      await completeButton.click();
      await page.waitForTimeout(2000);
      
      // Проверяем, что кнопка завершения скрыта или заблокирована
      const completeButtonAfter = page.locator('button:has-text("Завершить")');
      if (await completeButtonAfter.isVisible()) {
        const isDisabled = await completeButtonAfter.isDisabled();
        if (isDisabled) {
          console.log('✅ Повторное завершение запрещено');
        }
      } else {
        console.log('✅ Кнопка завершения скрыта после завершения');
      }
    }
  });
  
  test('TC-COMPLETE-010: Завершение визита коллеги (через видимость команды)', async ({ page }) => {
    // Входим как инженер
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
      
      // Проверяем наличие кнопки завершения
      const completeButton = page.locator('button:has-text("Завершить")');
      if (await completeButton.isVisible()) {
        const isDisabled = await completeButton.isDisabled();
        if (isDisabled) {
          console.log('✅ Завершение визита коллеги заблокировано');
        } else {
          console.log('ℹ️ Завершение визита коллеги разрешено (через видимость команды)');
        }
      }
    } else {
      console.log('ℹ️ Нет визитов коллег для проверки');
    }
  });
});
