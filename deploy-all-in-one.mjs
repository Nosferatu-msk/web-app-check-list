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
  console.log('=== Hotfix + Reset + Backfill ===\n');
  await exec('cd /opt/checklist && git pull');
  // Обновляем серверный код
  await exec('docker cp /opt/checklist/server/src/. checklist-server-1:/app/src/');
  await exec('docker cp /opt/checklist/shared/. checklist-server-1:/app/../shared/');
  await exec('docker cp /opt/checklist/server/tsconfig.json checklist-server-1:/app/tsconfig.json');
  await exec('docker exec -w /app checklist-server-1 npx tsc -p tsconfig.json 2>&1 | tail -3');
  // Перезапуск сервера
  await exec('docker restart checklist-server-1');
  await exec('sleep 5');
  // Копируем скрипт сброса
  await exec('docker cp /opt/checklist/server/scripts/reset-and-backfill.ts checklist-server-1:/app/scripts/');
  // Запускаем reset + backfill
  console.log('\n=== Reset + Backfill ===');
  await exec('docker exec checklist-server-1 npx tsx scripts/reset-and-backfill.ts');
  console.log('\n✅ Всё готово!');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
