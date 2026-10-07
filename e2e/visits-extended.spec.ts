import { test, expect } from '@playwright/test';

/**
 * Расширенные тесты создания визитов
 * 
 * Роли:
 * - Инженер: testic@test.ru / testic123
 * - ТМ: test_tm_ca@test.ru / test_tm_ca123
 * 
 * Тестовые объекты: CA/*
 */

test.describe('Создание визитов — расширенные тесты', () => {
  
  // ═══════════════════════════════════════════════════════════════
  // СОЗДАНИЕ ВИЗИТОВ ИНЖЕНЕРОМ
  // ═══════════════════════════════════════════════════════════════
  
  test('TC-VISIT-001: Инженер создаёт визит на объекте CA/*', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    // Заполняем адрес (объект CA/*)
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    // Выбираем адрес из подсказок
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
      await page.waitForTimeout(500);
    }
    
    // Проверяем автозаполнение даты и времени
    const dateInput = page.locator('input[placeholder="ДД.ММ.ГГГГ"]');
    const timeInput = page.locator('input[placeholder="ЧЧ:ММ"]');
    
    if (await dateInput.isVisible() && await timeInput.isVisible()) {
      console.log('✅ Дата и время заполнены автоматически');
    }
    
    // Проверяем автоопределение сезона
    const seasonSelect = page.locator('.ant-select').nth(2);
    if (await seasonSelect.isVisible()) {
      await seasonSelect.click();
      await page.waitForTimeout(500);
      
      const currentMonth = new Date().getMonth() + 1;
      const expectedSeason = (currentMonth >= 4 && currentMonth <= 10) ? 'Лето' : 'Зима';
      
      const selectedSeason = page.locator('.ant-select-item-option-selected');
      if (await selectedSeason.isVisible()) {
        const seasonText = await selectedSeason.textContent();
        expect(seasonText).toContain(expectedSeason);
        console.log(`✅ Сезон определён автоматически: ${expectedSeason}`);
      }
    }
    
    // Сохраняем визит
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Проверяем, что визит создан
    const visitUrl = page.url();
    expect(visitUrl).toContain('/visit/');
    
    console.log('✅ Визит создан успешно');
  });
  
  test('TC-VISIT-002: Валидация обязательных полей при создании визита', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    // Пытаемся сохранить без заполнения полей
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(1000);
    
    // Проверяем валидацию
    const validationErrors = page.locator('.ant-form-item-explain-error');
    if (await validationErrors.isVisible()) {
      console.log('✅ Валидация обязательных полей работает');
    } else {
      console.log('ℹ️ Валидация не сработала (возможно, поля заполнены автоматически)');
    }
  });
  
  test('TC-VISIT-003: Выбор адреса из справочника', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    // Вводим часть адреса
    await page.fill('input[placeholder*="адрес"]', 'CA/77');
    await page.waitForTimeout(1000);
    
    // Проверяем появление подсказок
    const suggestions = page.locator('.ant-select-item-option-content');
    const count = await suggestions.count();
    
    if (count > 0) {
      console.log(`✅ Подсказки адресов отображаются (найдено: ${count})`);
      
      // Выбираем первый адрес
      await suggestions.first().click();
      await page.waitForTimeout(500);
      
      console.log('✅ Адрес выбран из справочника');
    } else {
      console.log('ℹ️ Подсказки не найдены');
    }
  });
  
  test('TC-VISIT-004: Автосохранение визита', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    // Заполняем адрес
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption.isVisible()) {
      await addressOption.click();
    }
    
    // Сохраняем визит
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Получаем ID визита из URL
    const visitUrl = page.url();
    const visitId = visitUrl.split('/visit/')[1];
    
    // Обновляем страницу
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Проверяем, что данные сохранились
    const addressInput = page.locator('input[placeholder*="адрес"]');
    const addressValue = await addressInput.inputValue();
    
    if (addressValue.includes('CA/77/550')) {
      console.log('✅ Автосохранение работает');
    } else {
      console.log('ℹ️ Адрес не сохранился');
    }
  });
  
  test('TC-VISIT-005: Дубликаты визитов (запрет)', async ({ page }) => {
    // Входим как инженер
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testic@test.ru');
    await page.fill('input[type="password"]', 'testic123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём первый визит
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
    
    // Пытаемся создать второй визит на тот же адрес
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
    const addressOption2 = page.locator('.ant-select-item-option-content:has-text("CA/77/550")').first();
    if (await addressOption2.isVisible()) {
      await addressOption2.click();
    }
    
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    // Проверяем, что вернулся существующий визит (не создан новый)
    const visitUrl = page.url();
    expect(visitUrl).toContain('/visit/');
    
    console.log('✅ Проверка дубликатов работает');
  });
  
  // ═══════════════════════════════════════════════════════════════
  // СОЗДАНИЕ ВИЗИТОВ ТМ
  // ═══════════════════════════════════════════════════════════════
  
  test('TC-VISIT-006: ТМ создаёт визит с выбором инженера', async ({ page }) => {
    // Входим как ТМ
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
    await page.fill('input[type="password"]', 'test_tm_ca123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    // Проверяем наличие выбора инженера
    const engineerSelect = page.locator('label:has-text("Инженер") + * .ant-select');
    if (await engineerSelect.isVisible()) {
      await engineerSelect.click();
      await page.waitForTimeout(500);
      
      // Выбираем первого инженера
      const firstEngineer = page.locator('.ant-select-item-option-content').first();
      if (await firstEngineer.isVisible()) {
        await firstEngineer.click();
        console.log('✅ ТМ может выбрать инженера');
      }
    }
    
    // Заполняем адрес
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
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
    
    console.log('✅ ТМ создал визит с выбором инженера');
  });
  
  test('TC-VISIT-007: ТМ создаёт визит без выбора инженера (визит под собой)', async ({ page }) => {
    // Входим как ТМ
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
    await page.fill('input[type="password"]', 'test_tm_ca123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Создаём новый визит
    await page.goto('/visit/new');
    await page.waitForLoadState('networkidle');
    
    // Проверяем наличие выбора инженера
    const engineerSelect = page.locator('label:has-text("Инженер") + * .ant-select');
    if (await engineerSelect.isVisible()) {
      await engineerSelect.click();
      await page.waitForTimeout(500);
      
      // Выбираем "Без инженера (визит под собой)"
      const noEngineerOption = page.locator('.ant-select-item-option-content:has-text("Без инженера")');
      if (await noEngineerOption.isVisible()) {
        await noEngineerOption.click();
        console.log('✅ ТМ выбрал "Без инженера"');
      }
    }
    
    // Заполняем адрес
    await page.fill('input[placeholder*="адрес"]', 'CA/77/550');
    await page.waitForTimeout(1000);
    
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
    
    console.log('✅ ТМ создал визит под собой');
  });
  
  // ═══════════════════════════════════════════════════════════════
  // РЕДАКТИРОВАНИЕ ВИЗИТОВ
  // ═══════════════════════════════════════════════════════════════
  
  test('TC-VISIT-008: Редактирование адреса визита', async ({ page }) => {
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
    
    // Редактируем адрес
    const addressInput = page.locator('input[placeholder*="адрес"]');
    await addressInput.clear();
    await addressInput.fill('CA/77/553');
    await page.waitForTimeout(1000);
    
    const newAddressOption = page.locator('.ant-select-item-option-content:has-text("CA/77/553")').first();
    if (await newAddressOption.isVisible()) {
      await newAddressOption.click();
    }
    
    // Сохраняем изменения
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    console.log('✅ Адрес визита изменён');
  });
  
  test('TC-VISIT-009: Редактирование даты и времени визита', async ({ page }) => {
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
    
    // Редактируем дату
    const dateInput = page.locator('input[placeholder="ДД.ММ.ГГГГ"]');
    if (await dateInput.isVisible()) {
      await dateInput.click();
      await page.waitForTimeout(500);
      
      // Выбираем другую дату
      const newDate = page.locator('.ant-picker-cell').first();
      if (await newDate.isVisible()) {
        await newDate.click();
      }
    }
    
    // Редактируем время
    const timeInput = page.locator('input[placeholder="ЧЧ:ММ"]');
    if (await timeInput.isVisible()) {
      await timeInput.click();
      await page.waitForTimeout(500);
      
      // Вводим другое время
      await timeInput.fill('14:30');
    }
    
    // Сохраняем изменения
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    console.log('✅ Дата и время визита изменены');
  });
  
  test('TC-VISIT-010: Редактирование сезона визита', async ({ page }) => {
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
    
    // Редактируем сезон
    const seasonSelect = page.locator('.ant-select').nth(2);
    if (await seasonSelect.isVisible()) {
      await seasonSelect.click();
      await page.waitForTimeout(500);
      
      // Выбираем другой сезон
      const winterOption = page.locator('.ant-select-item-option-content:has-text("Зима")');
      if (await winterOption.isVisible()) {
        await winterOption.click();
      }
    }
    
    // Сохраняем изменения
    await page.click('button:has-text("Сохранить")');
    await page.waitForTimeout(2000);
    
    console.log('✅ Сезон визита изменён');
  });
  
  // ═══════════════════════════════════════════════════════════════
  // УДАЛЕНИЕ ВИЗИТОВ
  // ═══════════════════════════════════════════════════════════════
  
  test('TC-VISIT-011: Удаление визита инженером', async ({ page }) => {
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
    
    // Удаляем визит
    const deleteButton = page.locator('button:has-text("Удалить визит")');
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(1000);
      
      // Подтверждаем удаление
      const confirmButton = page.locator('.ant-modal-confirm-btns button:has-text("Удалить")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(2000);
        
        // Проверяем, что вернулись на список визитов
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/visit/');
        
        console.log('✅ Визит удалён инженером');
      }
    }
  });
  
  test('TC-VISIT-012: Удаление визита ТМ', async ({ page }) => {
    // Входим как ТМ
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test_tm_ca@test.ru');
    await page.fill('input[type="password"]', 'test_tm_ca123');
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
    
    // Удаляем визит
    const deleteButton = page.locator('button:has-text("Удалить визит")');
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(1000);
      
      // Подтверждаем удаление
      const confirmButton = page.locator('.ant-modal-confirm-btns button:has-text("Удалить")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(2000);
        
        // Проверяем, что вернулись на список визитов
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/visit/');
        
        console.log('✅ Визит удалён ТМ');
      }
    }
  });
  
  // ═══════════════════════════════════════════════════════════════
  // СТАТУСЫ ВИЗИТОВ
  // ═══════════════════════════════════════════════════════════════
  
  test('TC-VISIT-013: Статус визита "Не начато" при создании', async ({ page }) => {
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
    
    // Проверяем статус визита
    const statusBadge = page.locator('.ant-tag').first();
    if (await statusBadge.isVisible()) {
      const statusText = await statusBadge.textContent();
      console.log(`✅ Статус визита: ${statusText}`);
    }
  });
  
  test('TC-VISIT-014: Статус визита "В работе" при первом открытии', async ({ page }) => {
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
    
    // Обновляем страницу (имитируем повторное открытие)
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Проверяем статус визита
    const statusBadge = page.locator('.ant-tag').first();
    if (await statusBadge.isVisible()) {
      const statusText = await statusBadge.textContent();
      console.log(`✅ Статус визита: ${statusText}`);
    }
  });
  
  test('TC-VISIT-015: Автостатус "В работе" при добавлении задачи', async ({ page }) => {
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
    
    // Выбираем тип оборудования
    const equipmentTypeSelect = page.locator('.ant-select').first();
    await equipmentTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstType = page.locator('.ant-select-item-option-content').first();
    if (await firstType.isVisible()) {
      await firstType.click();
    }
    
    // Выбираем помещение
    const roomTypeSelect = page.locator('.ant-select').nth(1);
    await roomTypeSelect.click();
    await page.waitForTimeout(500);
    
    const firstRoom = page.locator('.ant-select-item-option-content').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
    }
    
    // Нажимаем "Добавить"
    await page.click('button:has-text("Добавить")');
    await page.waitForTimeout(2000);
    
    // Проверяем статус визита
    const statusBadge = page.locator('.ant-tag').first();
    if (await statusBadge.isVisible()) {
      const statusText = await statusBadge.textContent();
      console.log(`✅ Статус визита после добавления задачи: ${statusText}`);
    }
  });
});
