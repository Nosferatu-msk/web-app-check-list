#!/usr/bin/env node

/**
 * Скрипт запуска автоматических тестов перед деплоем
 * 
 * Использование:
 *   node run-tests.js          — запуск всех тестов
 *   node run-tests.js --report — запуск с открытием отчёта
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPORT_DIR = 'test-reports';
const HTML_REPORT = path.join(REPORT_DIR, 'html', 'index.html');

console.log('🧪 Запуск автоматических тестов...\n');

// Проверяем, что сервер запущен
try {
  execSync('curl -s http://localhost:5173 > /dev/null', { stdio: 'ignore' });
  console.log('✅ Сервер работает на localhost:5173\n');
} catch {
  console.log('⚠️  Сервер не запущен. Запускаю...\n');
  // Сервер будет запущен автоматически через webServer в playwright.config.ts
}

// Очищаем старые отчёты
if (fs.existsSync(REPORT_DIR)) {
  fs.rmSync(REPORT_DIR, { recursive: true });
}

// Запускаем тесты
try {
  console.log('📋 Выполнение тестов...\n');
  execSync('npx playwright test', { stdio: 'inherit' });
  
  console.log('\n✅ Все тесты пройдены!\n');
  
  // Генерируем сводку
  generateSummary();
  
} catch (error) {
  console.log('\n❌ Обнаружены ошибки в тестах!\n');
  
  // Генерируем сводку с ошибками
  generateSummary();
  
  process.exit(1);
}

function generateSummary() {
  const resultsFile = path.join(REPORT_DIR, 'results.json');
  
  if (fs.existsSync(resultsFile)) {
    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
    
    const total = results.suites.reduce((acc, suite) => {
      return acc + suite.specs.reduce((a, s) => a + s.tests.length, 0);
    }, 0);
    
    const passed = results.suites.reduce((acc, suite) => {
      return acc + suite.specs.reduce((a, s) => {
        return a + s.tests.filter(t => t.results[0]?.status === 'passed').length;
      }, 0);
    }, 0);
    
    const failed = total - passed;
    
    console.log('═══════════════════════════════════════════');
    console.log('           СВОДКА ПО ТЕСТАМ');
    console.log('═══════════════════════════════════════════');
    console.log(`  Всего тестов:  ${total}`);
    console.log(`  ✅ Пройдено:   ${passed}`);
    console.log(`  ❌ Провалено:  ${failed}`);
    console.log('═══════════════════════════════════════════\n');
    
    if (failed > 0) {
      console.log('📝 Подробный отчёт: test-reports/html/index.html\n');
    }
  }
  
  if (fs.existsSync(HTML_REPORT)) {
    console.log(`📊 HTML-отчёт: ${HTML_REPORT}\n`);
    
    if (process.argv.includes('--report')) {
      try {
        execSync(`start "" "${path.resolve(HTML_REPORT)}"`, { stdio: 'ignore' });
      } catch {
        // Если start не работает (не Windows), пробуем open
        try {
          execSync(`open "${path.resolve(HTML_REPORT)}"`, { stdio: 'ignore' });
        } catch {
          console.log('⚠️  Не удалось открыть отчёт автоматически');
        }
      }
    }
  }
}
