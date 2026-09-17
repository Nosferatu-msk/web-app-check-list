import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd) {
  return new Promise((res, rej) => {
    console.log(`>>> ${cmd.slice(0, 120)}`);
    conn.exec(cmd, (err, s) => {
      if (err) return rej(err);
      let o = '';
      s.on('data', d => { o += d; process.stdout.write(d); });
      s.stderr.on('data', d => process.stderr.write(d));
      s.on('close', c => { console.log(`\n<<< exit: ${c}`); res({ c, o }); });
    });
  });
}
conn.on('ready', async () => {
  console.log('=== Hotfix deploy ===\n');
  await exec('cd /opt/checklist && git pull');
  // Копируем обновлённые файлы в контейнер
  await exec('docker cp /opt/checklist/server/src/. checklist-server-1:/app/src/');
  await exec('docker cp /opt/checklist/shared/. checklist-server-1:/app/../shared/');
  await exec('docker cp /opt/checklist/server/tsconfig.json checklist-server-1:/app/tsconfig.json');
  // Компилируем
  await exec('docker exec -w /app checklist-server-1 npx tsc -p tsconfig.json 2>&1 | tail -5');
  // Клиент — пересобираем (быстро, без chromium)
  await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml build client');
  // Перезапуск
  await exec('docker restart checklist-server-1');
  await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d');
  await exec('sleep 5');
  await exec('docker logs checklist-server-1 --tail 3');
  await exec('docker compose -f /opt/checklist/docker-compose.prod.yml ps');
  console.log('\n✅ Hotfix deploy завершён!');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
