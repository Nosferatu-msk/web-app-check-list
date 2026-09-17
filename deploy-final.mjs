import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd) {
  return new Promise((res, rej) => {
    conn.exec(cmd, (err, s) => {
      if (err) return rej(err);
      let o = '';
      s.on('data', d => { o += d; process.stdout.write(d); });
      s.stderr.on('data', d => process.stderr.write(d));
      s.on('close', c => res({ c, o }));
    });
  });
}
conn.on('ready', async () => {
  console.log('SSH connected');
  // Проверяем завершилась ли сборка
  const { o } = await exec('tail -3 /tmp/build.log');
  if (o.includes('BUILD_DONE')) {
    console.log('\nСборка завершена! Перезапуск сервера...');
    await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d');
    await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml ps');
    console.log('✅ Готово!');
  } else {
    console.log('\nСборка ещё идёт. Запустим пересборку без кэша...');
    // Убиваем зависшую сборку и пересобираем
    await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml build --no-cache server > /tmp/build2.log 2>&1 &');
    console.log('Сборка запущена в фоне. Проверьте через 5-10 минут: tail -5 /tmp/build2.log');
  }
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
