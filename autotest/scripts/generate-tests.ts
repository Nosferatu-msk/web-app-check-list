import fs from 'fs';
import path from 'path';

// Config
const TEST_CASES_FILE = process.env.TEST_CASES_FILE || path.resolve(__dirname, '../../Тест-кейсы.md');
const TESTS_DIR = path.resolve(__dirname, '../tests');

// TC categories mapping — which directory to put tests in based on TC number ranges or keywords
const CATEGORY_MAP: { keywords: string[]; dir: string; suite: string }[] = [
  { keywords: ['авторизац', 'вход', 'логин', 'пароль', 'login'], dir: 'auth', suite: 'Авторизация' },
  { keywords: ['визит', 'visit', 'адрес', 'задач', 'параметр', 'оборудован'], dir: 'visits', suite: 'Визиты и задачи' },
  { keywords: ['фото', 'photo', '152'], dir: 'photos', suite: 'Фотофиксация' },
  { keywords: ['отчёт', 'report', 'pdf', 'zip', 'email'], dir: 'reports', suite: 'Отчёты' },
  { keywords: ['админ', 'admin', 'справочник', 'аудит', 'crud'], dir: 'admin', suite: 'Админка' },
  { keywords: ['тм', 'tm', 'менеджер', 'переназнач', 'дашборд', 'soft delete'], dir: 'tm', suite: 'ТМ' },
  { keywords: ['офлайн', 'offline', 'pwa', 'service worker', 'синхронизац', 'кэш'], dir: 'offline', suite: 'Офлайн' },
  { keywords: ['импорт', 'csv', 'массовый'], dir: 'import', suite: 'Импорт' },
  { keywords: ['объект-оборудован', 'object-equipment', 'автозаполнен', 'привязк'], dir: 'object-equipment', suite: 'Объект-Оборудование' },
  { keywords: ['автосохранен', 'autosave'], dir: 'autosave', suite: 'Автосохранение' },
  { keywords: ['предлож', 'approval', 'утвержд'], dir: 'proposals', suite: 'Предложения' },
  { keywords: ['сводн', 'summary', 'период', 'отчёт по объекту'], dir: 'summary-reports', suite: 'Сводные отчёты' },
  { keywords: ['пагинац', 'pagination', 'pageSize'], dir: 'pagination', suite: 'Пагинация' },
  { keywords: ['специализац', 'specialization', 'вик', 'исж'], dir: 'specialization', suite: 'Специализация' },
  { keywords: ['личн', 'профиль', 'profile', 'избранн', 'favorite'], dir: 'profile', suite: 'Личный кабинет' },
  { keywords: ['rate limit', 'brute'], dir: 'security', suite: 'Безопасность' },
  { keywords: ['иконк', 'icon', 'pwa'], dir: 'pwa', suite: 'PWA' },
];

interface TestCase {
  id: string;
  title: string;
  priority: string;
  description: string;
  steps: string[];
  expectedResult: string;
  category: string;
  suite: string;
}

function parseTestCases(content: string): TestCase[] {
  const cases: TestCase[] = [];
  // Match patterns like: ## TC-XXX: Title
  const tcRegex = /##\s+(TC-\d+):\s*(.+?)(?:\n|$)/g;
  const sections = content.split(/(?=## TC-\d+:)/);

  for (const section of sections) {
    const headerMatch = section.match(/##\s+(TC-\d+):\s*(.+?)(?:\n|$)/);
    if (!headerMatch) continue;

    const id = headerMatch[1];
    const title = headerMatch[2].trim();

    // Extract priority
    const priorityMatch = section.match(/\*\*Приоритет:\*\*\s*(Критический|Высокий|Средний|Низкий)/i);
    const priority = priorityMatch ? priorityMatch[1].toLowerCase() : 'medium';

    // Extract steps
    const stepsMatch = section.match(/\*\*Шаги:\*\*\s*\n((?:\d+\..+\n?)+)/);
    const steps = stepsMatch ? stepsMatch[1].trim().split('\n').map(s => s.replace(/^\d+\.\s*/, '').trim()) : [];

    // Extract expected result — stop before known metadata lines (Приоритет, Шаги, etc.)
    const expectedMatch = section.match(/\*\*Ожидаемый результат:\*\*\s*([\s\S]+?)(?=\n\*\*Приоритет:|\n\*\*Шаги:|\n\n|\n##|\n---|$)/);
    let expectedResult = expectedMatch ? expectedMatch[1].trim() : '';
    // Safety: strip any priority line that may have leaked into the result
    expectedResult = expectedResult.replace(/\*\*Приоритет:\*\*\s*\S+/gi, '').trim();

    // Determine category
    const lowerSection = (title + ' ' + expectedResult + ' ' + steps.join(' ')).toLowerCase();
    let category = 'misc';
    let suite = 'Прочее';
    for (const cat of CATEGORY_MAP) {
      if (cat.keywords.some(kw => lowerSection.includes(kw))) {
        category = cat.dir;
        suite = cat.suite;
        break;
      }
    }

    cases.push({ id, title, priority, description: title, steps, expectedResult, category, suite });
  }

  return cases;
}

function findExistingTests(): Set<string> {
  const existing = new Set<string>();
  
  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.spec.ts')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const matches = content.match(/TC-\d+/g);
        if (matches) {
          matches.forEach(tc => existing.add(tc));
        }
      }
    }
  }

  scanDir(TESTS_DIR);
  return existing;
}

function generateTemplate(tc: TestCase): string {
  const priorityTag = tc.priority === 'critical' ? '@critical' : tc.priority === 'high' ? '@high' : tc.priority === 'medium' ? '@medium' : '@low';
  
  // Determine if this should be UI or API test based on keywords
  const isApiTest = tc.title.toLowerCase().includes('api') || 
                    tc.steps.some(s => s.toLowerCase().includes('api') || s.toLowerCase().includes('запрос'));
  const testType = isApiTest ? '@api' : '@ui';

  // Comment out each line of the expected result so it's valid TS
  const commentedResult = tc.expectedResult
    .split('\n')
    .map((line, i) => (i === 0 ? `    // Ожидаемый результат: ${line}` : `    // ${line}`))
    .join('\n');

  let stepsCode = '';
  if (isApiTest) {
    stepsCode = `    const api = new ApiClient(request);
    await api.authenticate('engineer');

    // TODO: Реализовать шаги из Тест-кейсы.md
    // ${tc.steps.join('\n    // ')}

    // TODO: Добавить проверки
${commentedResult}`;
  } else {
    stepsCode = `    await loginViaUI(page, 'engineer');

    // TODO: Реализовать шаги из Тест-кейсы.md
${tc.steps.map((s, i) => `    // Шаг ${i + 1}: ${s}`).join('\n')}

    // TODO: Добавить проверки
${commentedResult}`;
  }

  const imports = isApiTest
    ? `import { test, expect } from '@playwright/test';
import { ApiClient } from '../../helpers/api-client.js';`
    : `import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../helpers/auth.js';`;

  return `${imports}

test.describe('${tc.suite} ${testType}', () => {

  test('${tc.id}: ${tc.title} ${priorityTag} ${testType}', async ({ ${isApiTest ? 'request' : 'page'} }) => {
${stepsCode}
  });
});
`;
}

function main() {
  console.log('🧪 Генератор тестов из Тест-кейсы.md\n');

  // Read test cases file
  if (!fs.existsSync(TEST_CASES_FILE)) {
    console.error(`❌ Файл не найден: ${TEST_CASES_FILE}`);
    console.log('   Укажите путь через переменную TEST_CASES_FILE');
    process.exit(1);
  }

  const content = fs.readFileSync(TEST_CASES_FILE, 'utf-8');
  const testCases = parseTestCases(content);
  console.log(`📄 Найдено тест-кейсов в документе: ${testCases.length}`);

  // Find existing tests
  const existing = findExistingTests();
  console.log(`✅ Уже реализовано тестов: ${existing.size}`);

  // Find missing
  const missing = testCases.filter(tc => !existing.has(tc.id));
  console.log(`❌ Отсутствует тестов: ${missing.length}\n`);

  if (missing.length === 0) {
    console.log('🎉 Все тест-кейсы уже реализованы!');
    return;
  }

  // Group by category
  const grouped = new Map<string, TestCase[]>();
  for (const tc of missing) {
    if (!grouped.has(tc.category)) grouped.set(tc.category, []);
    grouped.get(tc.category)!.push(tc);
  }

  // Generate templates
  let generated = 0;
  for (const [category, cases] of grouped) {
    const dir = path.join(TESTS_DIR, category);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileName = `${category}-generated.spec.ts`;
    const filePath = path.join(dir, fileName);

    // If file already exists, append to it
    let existingContent = '';
    if (fs.existsSync(filePath)) {
      existingContent = fs.readFileSync(filePath, 'utf-8');
    }

    let newContent = existingContent;
    for (const tc of cases) {
      const template = generateTemplate(tc);
      // Extract just the test block (not imports/describe wrapper for appending)
      const testBlock = template.split('\n').slice(
        template.indexOf("test.describe") !== -1 ? template.indexOf("test.describe") : 0
      ).join('\n');

      if (existingContent) {
        // Append test inside existing describe or add new describe
        newContent += `\n${testBlock}\n`;
      } else {
        newContent = template;
      }
    }

    fs.writeFileSync(filePath, newContent, 'utf-8');
    generated += cases.length;

    console.log(`📝 ${category}/`);
    for (const tc of cases) {
      const priority = tc.priority === 'critical' ? '🔴' : tc.priority === 'high' ? '🟠' : '🟡';
      console.log(`   ${priority} ${tc.id}: ${tc.title}`);
    }
    console.log(`   → ${fileName}\n`);
  }

  console.log(`\n✨ Сгенерировано шаблонов: ${generated}`);
  console.log(`📂 Файлы созданы в: ${TESTS_DIR}`);
  console.log(`\n⚠️  Не забудьте реализовать TODO в сгенерированных файлах!`);
}

main();
