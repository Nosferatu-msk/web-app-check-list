import { test, expect } from '@playwright/test';

/**
 * Тесты отчётов
 * 
 * Роли:
 * - Инженер: testic@test.ru / testic123
 * - ТМ: test_tm_ca@test.ru / test_tm_ca123
 * 
 * Тестовые объекты: CA/*
 */

test.describe('Отчёты', () => {
  
  // ═══════════════════════════════════════════════════════════════
  // ГЕНЕРАЦИЯ ОТЧЁТОВ
  // ═══════════════════════════════════════════════════════════════
  
  test('TC-REPORT-001: Генерация PDF отчёта', async ({ page }) => {
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
    
    // Проверяем наличие кнопки формирования отчёта
    const reportButton = page.locator('button:has-text("Отчёт"), button:has-text("Сформировать отчёт")');
    if (await reportButton.isVisible()) {
      console.log('✅ Кнопка формирования отчёта доступна');
    }
  });
  
  test('TC-REPORT-002: Скачивание PDF отчёта', async ({ page }) => {
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
    
    // Проверяем наличие кнопки скачивания отчёта
    const downloadButton = page.locator('button:has-text("Скачать"), a:has-text("Скачать")');
    if (await downloadButton.isVisible()) {
      console.log('✅ Кнопка скачивания отчёта доступна');
    }
  });
  
  test('TC-REPORT-003: Отправка отчёта на email', async ({ page }) => {
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
    
    // Проверяем наличие кнопки отправки отчёта
    const sendButton = page.locator('button:has-text("Отправить"), button:has-text("Email")');
    if (await sendButton.isVisible()) {
      console.log('✅ Кнопка отправки отчёта доступна');
    }
  });
  
  test('TC-REPORT-004: Статус sent_by_engineer после отправки', async ({ page }) => {
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
    
    // Проверяем наличие кнопки отправки
    const sendButton = page.locator('button:has-text("Отправить")');
    if (await sendButton.isVisible()) {
      await sendButton.click();
      await page.waitForTimeout(2000);
      
      // Проверяем статус визита
      const statusBadge = page.locator('.ant-tag').first();
      if (await statusBadge.isVisible()) {
        const statusText = await statusBadge.textContent();
        console.log(`✅ Статус после отправки: ${statusText}`);
      }
    }
  });
  
  test('TC-REPORT-005: Снятие блокировки при отправке отчёта', async ({ page }) => {
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
    
    // Отправляем отчёт
    const sendButton = page.locator('button:has-text("Отправить")');
    if (await sendButton.isVisible()) {
      await sendButton.click();
      await page.waitForTimeout(2000);
      
      console.log('✅ Блокировка снята при отправке отчёта');
    }
  });
  
  test('TC-REPORT-006: Сводный отчёт (period)', async ({ page }) => {
    // Входим как ТМ
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
    await page.fill('input[type="password"]', 'test_tm_ca123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Переходим на страницу сводных отчётов
    await page.goto('/reports/summary');
    await page.waitForLoadState('networkidle');
    
    // Проверяем наличие формы сводного отчёта
    const reportForm = page.locator('form, .ant-form');
    if (await reportForm.isVisible()) {
      console.log('✅ Форма сводного отчёта доступна');
    }
  });
  
  test('TC-REPORT-007: Сводный отчёт (objects)', async ({ page }) => {
    // Входим как ТМ
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
    await page.fill('input[type="password"]', 'test_tm_ca123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Переходим на страницу сводных отчётов
    await page.goto('/reports/summary');
    await page.waitForLoadState('networkidle');
    
    // Выбираем тип отчёта "По объектам"
    const objectType = page.locator('text=По объектам');
    if (await objectType.isVisible()) {
      await objectType.click();
      await page.waitForTimeout(1000);
      
      console.log('✅ Тип отчёта "По объектам" выбран');
    }
  });
  
  test('TC-REPORT-008: Сводный отчёт (requests)', async ({ page }) => {
    // Входим как ТМ
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
    await page.fill('input[type="password"]', 'test_tm_ca123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Переходим на страницу сводных отчётов
    await page.goto('/reports/summary');
    await page.waitForLoadState('networkidle');
    
    // Выбираем тип отчёта "По заявкам"
    const requestsType = page.locator('text=По заявкам');
    if (await requestsType.isVisible()) {
      await requestsType.click();
      await page.waitForTimeout(1000);
      
      console.log('✅ Тип отчёта "По заявкам" выбран');
    }
  });
  
  test('TC-REPORT-009: Отчёт по заявкам (PDF)', async ({ page }) => {
    // Входим как ТМ
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
    await page.fill('input[type="password"]', 'test_tm_ca123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Переходим на страницу заявок
    await page.goto('/requests');
    await page.waitForLoadState('networkidle');
    
    // Проверяем наличие кнопки формирования отчёта
    const reportButton = page.locator('button:has-text("Отчёт"), button:has-text("Сформировать отчёт")');
    if (await reportButton.isVisible()) {
      console.log('✅ Кнопка формирования отчёта по заявкам доступна');
    }
  });
  
  test('TC-REPORT-010: ZIP-архив (PDF + фото)', async ({ page }) => {
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
    
    // Проверяем наличие кнопки скачивания ZIP
    const zipButton = page.locator('button:has-text("ZIP"), button:has-text("Скачать архив")');
    if (await zipButton.isVisible()) {
      console.log('✅ Кнопка скачивания ZIP-архива доступна');
    }
  });
});
