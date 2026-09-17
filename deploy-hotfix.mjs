import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd) {
  return new Promise((res, rej) => {
    console.log(`>>> ${cmd}`);
    conn.exec(cmd, (err, s) => {
      if (err) return rej(err);
      let o = '';
      s.on('data', d => { o += d; process.stdout.write(d); });
      s.stderr.on('data', d => process.stderr.write(d));
      s.on('close', c => { console.log(`<<< exit: ${c}`); res({ c, o }); });
    });
  });
}
conn.on('ready', async () => {
  console.log('=== Быстрое обновление без пересборки образа ===\n');

  // 1. Убиваем зависшую сборку
  await exec('pkill -f "docker.*build" 2>/dev/null; sleep 2');

  // 2. Компилируем сервер прямо на хосте (без Docker)
  // На сервере уже есть node_modules и всё необходимое в /opt/checklist/server
  await exec('cd /opt/checklist/server && npx tsc 2>&1 | tail -5');

  // 3. Копируем обновлённый dist/ в контейнер
  await exec('docker cp /opt/checklist/server/dist/. checklist-server-1:/app/dist/');

  // 4. Перезапускаем сервер
  await exec('docker restart checklist-server-1');

  // 5. Ждём запуска
  await exec('sleep 5');

  // 6. Проверяем
  await exec('docker compose -f /opt/checklist/docker-compose.prod.yml ps');
  await exec('docker logs checklist-server-1 --tail 5');

  console.log('\n✅ Быстрое обновление завершено!');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
