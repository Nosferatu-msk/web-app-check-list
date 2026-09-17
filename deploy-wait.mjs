import { Client } from 'ssh2';

const conn = new Client();

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (data) => { out += data.toString(); process.stdout.write(data); });
      stream.stderr.on('data', (data) => process.stderr.write(data));
      stream.on('close', (code) => resolve({ code, out }));
    });
  });
}

conn.on('ready', async () => {
  console.log('SSH connected. Ожидание завершения сборки сервера...');

  // Ждём завершения сборки (проверяем каждые 30 сек)
  for (let i = 0; i < 20; i++) {
    const { out } = await execCommand(conn, 'tail -1 /tmp/build.log');
    if (out.includes('BUILD_DONE')) {
      console.log('\n✅ Сборка завершена!');
      break;
    }
    console.log(`  Проверка ${i + 1}/20... сборка продолжается`);
    await new Promise(r => setTimeout(r, 30000));
  }

  // Перезапускаем сервер
  console.log('\nПерезапуск контейнеров...');
  await execCommand(conn, 'cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d');
  await execCommand(conn, 'cd /opt/checklist && docker compose -f docker-compose.prod.yml ps');
  console.log('\n✅ Деплой полностью завершён!');
  conn.end();
});

conn.on('error', (err) => { console.error('SSH error:', err.message); process.exit(1); });
conn.connect({
  host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa',
  keepaliveInterval: 10000, keepaliveCountMax: 30,
});
