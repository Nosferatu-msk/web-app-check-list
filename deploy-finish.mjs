import { Client } from 'ssh2';

const conn = new Client();

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '', stderr = '';
      stream.on('data', (data) => { stdout += data.toString(); process.stdout.write(data); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); process.stderr.write(data); });
      stream.on('close', (code) => {
        console.log(`\n<<< exit code: ${code}`);
        resolve({ code, stdout, stderr });
      });
    });
  });
}

conn.on('ready', async () => {
  console.log('SSH connected');
  try {
    // Обновляем код на сервере
    await execCommand(conn, 'cd /opt/checklist && git pull');

    // Миграция (уже применена, но на всякий случай)
    await execCommand(conn, 'cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy');

    // Копируем backfill-скрипт в контейнер
    await execCommand(conn, 'docker exec checklist-server-1 mkdir -p /app/scripts');
    await execCommand(conn, 'docker cp /opt/checklist/server/scripts/backfill-verification.ts checklist-server-1:/app/scripts/backfill-verification.ts');

    // Компилируем и запускаем backfill
    console.log('\n=== Запуск backfill верификации ===');
    await execCommand(conn, 'cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server npx tsx scripts/backfill-verification.ts');

    // Статус контейнеров
    await execCommand(conn, 'cd /opt/checklist && docker compose -f docker-compose.prod.yml ps');

    console.log('\n✅ Деплой и backfill завершены!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    conn.end();
  }
});

conn.on('error', (err) => { console.error('SSH error:', err.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa' });
