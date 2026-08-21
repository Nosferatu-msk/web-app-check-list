import { execSync } from 'child_process';
import path from 'path';

/**
 * Глобальный setup для E2E-тестов.
 * Запускает PostgreSQL через Docker Compose и ждёт его готовности.
 */
export default async function globalSetup() {
  const root = path.resolve(__dirname, '..');

  // 1. Проверяем, что docker доступен
  try {
    execSync('docker --version', { stdio: 'ignore' });
  } catch {
    console.log('[global-setup] Docker не найден — пропускаем запуск БД');
    return;
  }

  // 2. Запускаем PostgreSQL через docker compose (detached, идемпотентно)
  try {
    execSync('docker compose up -d db', {
      cwd: root,
      stdio: 'pipe',
      timeout: 30_000,
    });
    console.log('[global-setup] PostgreSQL контейнер запущен');
  } catch (err) {
    console.log('[global-setup] docker compose up failed:', (err as Error).message);
  }

  // 3. Ждём, пока PostgreSQL реально начнёт принимать TCP-соединения на localhost:5432
  const maxWait = 20_000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      // Пытаемся подключиться к БД через Node.js
      await new Promise<void>((resolve, reject) => {
        const net = require('net');
        const sock = net.createConnection(5432, 'localhost');
        sock.setTimeout(2000);
        sock.on('connect', () => { sock.destroy(); resolve(); });
        sock.on('error', (e: Error) => reject(e));
        sock.on('timeout', () => { sock.destroy(); reject(new Error('timeout')); });
      });
      console.log('[global-setup] PostgreSQL принимает соединения на localhost:5432');
      break;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // 4. Дополнительная задержка — даём PostgreSQL полностью инициализироваться
  await new Promise(r => setTimeout(r, 2000));
  console.log('[global-setup] Global setup complete');
}
