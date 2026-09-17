import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd) {
  return new Promise((res, rej) => {
    console.log(`>>> ${cmd.slice(0, 150)}`);
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
  console.log('=== Hotfix v3: полная компиляция в контейнере ===\n');

  // Проверяем структуру
  await exec('docker exec checklist-server-1 ls /app/');
  await exec('docker exec checklist-server-1 ls /app/tsconfig.json 2>/dev/null || echo "no tsconfig"');
  await exec('docker exec checklist-server-1 cat /app/tsconfig.json 2>/dev/null | head -5 || echo "no tsconfig"');

  // Копируем tsconfig если нет
  await exec('docker cp /opt/checklist/server/tsconfig.json checklist-server-1:/app/tsconfig.json');

  // Копируем package.json (нужен для paths)
  await exec('docker cp /opt/checklist/server/package.json checklist-server-1:/app/package.json');

  // Компилируем с явным указанием проекта
  await exec('docker exec -w /app checklist-server-1 npx tsc -p tsconfig.json 2>&1 | tail -15');

  // Проверяем что dist обновился
  await exec('docker exec checklist-server-1 ls -la /app/dist/services/analyticsService.js 2>/dev/null || echo "no file"');

  // Перезапускаем
  await exec('docker restart checklist-server-1');
  await exec('sleep 5');
  await exec('docker logs checklist-server-1 --tail 3');

  console.log('\n✅ Hotfix v3 завершён!');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
