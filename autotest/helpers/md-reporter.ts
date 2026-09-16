import { Reporter, FullConfig, Suite, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

interface TestEntry {
  id: string;
  title: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: string;
  tags: string[];
  retryCount: number;
}

class MarkdownReporter implements Reporter {
  private tests: TestEntry[] = [];
  private startTime: Date = new Date();
  private reportDir: string;

  constructor() {
    this.reportDir = path.resolve('./reports');
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  onBegin(config: FullConfig, suite: Suite) {
    console.log(`\n🧪 Starting test run: ${suite.allTests().length} tests\n`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const title = test.title;
    const tags: string[] = title.match(/TC-\d+/g) || [];
    const priorityMatch = title.match(/@(critical|high|medium|low)/i);
    if (priorityMatch) tags.push(priorityMatch[0]);

    // Also check test annotations/tags
    const testTags: string[] = test.tags ? [...test.tags] : [];
    tags.push(...testTags);

    const entry: TestEntry = {
      id: tags[0] || test.id,
      title: title.replace(/@\w+/g, '').trim(),
      suite: test.parent?.title || 'Unknown',
      status: result.status === 'passed' ? 'passed' : result.status as TestEntry['status'],
      duration: result.duration,
      error: result.error?.message,
      tags: [...new Set(tags)],
      retryCount: result.retry,
    };
    this.tests.push(entry);
  }

  onEnd(result: FullResult) {
    const endTime = new Date();
    const duration = ((endTime.getTime() - this.startTime.getTime()) / 1000).toFixed(1);
    const passed = this.tests.filter(t => t.status === 'passed').length;
    const failed = this.tests.filter(t => t.status === 'failed' || t.status === 'timedOut').length;
    const skipped = this.tests.filter(t => t.status === 'skipped').length;
    const total = this.tests.length;

    const dateStr = endTime.toISOString().slice(0, 10);
    const timeStr = endTime.toTimeString().slice(0, 5).replace(':', '-');
    const fileName = `test-report_${dateStr}_${timeStr}.md`;
    const filePath = path.join(this.reportDir, fileName);

    let md = '';
    md += `# 🧪 Отчёт автотестирования\n\n`;
    md += `**Дата:** ${endTime.toLocaleDateString('ru-RU')} ${endTime.toLocaleTimeString('ru-RU')}\n`;
    md += `**Длительность:** ${duration} сек\n`;
    md += `**Статус:** ${result.status === 'passed' ? '✅ Успешно' : '❌ Есть failures'}\n\n`;

    md += `## 📊 Сводка\n\n`;
    md += `| Метрика | Значение |\n|---------|----------|\n`;
    md += `| Всего тестов | ${total} |\n`;
    md += `| ✅ Пройдено | ${passed} |\n`;
    md += `| ❌ Провалено | ${failed} |\n`;
    md += `| ⏭️ Пропущено | ${skipped} |\n`;
    md += `| Процент успеха | ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}% |\n\n`;

    // Priority breakdown
    const critical = this.tests.filter(t => t.tags.some(tag => tag.toLowerCase() === '@critical' || tag.toLowerCase() === 'critical'));
    const high = this.tests.filter(t => t.tags.some(tag => tag.toLowerCase() === '@high' || tag.toLowerCase() === 'high'));

    if (critical.length > 0 || high.length > 0) {
      md += `## 🎯 По приоритетам\n\n`;
      md += `| Приоритет | Всего | ✅ | ❌ |\n|-----------|-------|----|----||\n`;
      if (critical.length > 0) {
        const cp = critical.filter(t => t.status === 'passed').length;
        md += `| 🔴 Critical | ${critical.length} | ${cp} | ${critical.length - cp} |\n`;
      }
      if (high.length > 0) {
        const hp = high.filter(t => t.status === 'passed').length;
        md += `| 🟠 High | ${high.length} | ${hp} | ${high.length - hp} |\n`;
      }
      md += `\n`;
    }

    // Failed tests detail
    const failedTests = this.tests.filter(t => t.status === 'failed' || t.status === 'timedOut');
    if (failedTests.length > 0) {
      md += `## ❌ Проваленные тесты\n\n`;
      md += `> **Всего failures:** ${failedTests.length}\n\n`;

      for (const t of failedTests) {
        const priority = t.tags.find(tag => tag.toLowerCase().includes('critical')) ? '🔴' :
                         t.tags.find(tag => tag.toLowerCase().includes('high')) ? '🟠' : '🟡';
        md += `### ${priority} ${t.id}: ${t.title}\n\n`;
        md += `- **Набор:** ${t.suite}\n`;
        md += `- **Статус:** ${t.status}\n`;
        md += `- **Время:** ${(t.duration / 1000).toFixed(2)} сек\n`;
        md += `- **Теги:** ${t.tags.join(', ')}\n`;
        if (t.error) {
          md += `- **Ошибка:**\n\`\`\`\n${t.error.slice(0, 500)}\n\`\`\`\n`;
        }
        md += `\n`;
      }
    }

    // All tests table
    md += `## 📋 Полный список тестов\n\n`;
    md += `| ID | Тест | Набор | Статус | Время | Теги |\n`;
    md += `|----|------|-------|--------|-------|------|\n`;
    for (const t of this.tests) {
      const icon = t.status === 'passed' ? '✅' : t.status === 'failed' ? '❌' : t.status === 'timedOut' ? '⏰' : '⏭️';
      md += `| ${t.id} | ${t.title.slice(0, 50)} | ${t.suite.slice(0, 20)} | ${icon} ${t.status} | ${(t.duration / 1000).toFixed(1)}с | ${t.tags.join(', ')} |\n`;
    }

    md += `\n---\n*Сгенерировано модулем автотестирования web-app-autotest*\n`;

    fs.writeFileSync(filePath, md, 'utf-8');
    console.log(`\n📄 Отчёт сохранён: ${filePath}\n`);
  }
}

export default MarkdownReporter;
