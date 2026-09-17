import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd) {
  return new Promise((res, rej) => {
    conn.exec(cmd, (err, s) => {
      if (err) return rej(err);
      let o = '';
      s.on('data', d => { o += d; });
      s.stderr.on('data', d => { o += d; });
      s.on('close', c => res({ c, o }));
    });
  });
}
conn.on('ready', async () => {
  console.log('Финальное ожидание сборки...');
  for (let i = 0; i < 60; i++) {
    const { o } = await exec('tail -1 /tmp/build3.log 2>/dev/null');
    const line = o.trim().split('\n').pop() || '';
    if (i % 4 === 0) process.stdout.write(`[${i+1}/60] ${line.slice(-60)}\n`);

    // Проверяем завершение
    if (o.includes('naming to docker.io') || (o.includes('DONE') && !o.includes('apk add'))) {
      await new Promise(r => setTimeout(r, 10000));
      console.log('\n✅ Сборка завершена! Перезапуск...');
      await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d');
      const { o: ps } = await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml ps');
      console.log(ps);
      console.log('✅ ДЕПЛОЙ ПОЛНОСТЬЮ ЗАВЕРШЁН!');
      conn.end();
      return;
    }

    // Проверяем ошибку
    if (o.includes('failed') || o.includes('error')) {
      console.log('\n❌ Ошибка сборки:');
      await exec('tail -10 /tmp/build3.log');
      conn.end();
      return;
    }

    await new Promise(r => setTimeout(r, 15000));
  }
  console.log('Таймаут 15 мин. Сборка всё ещё идёт.');
  await exec('tail -5 /tmp/build3.log');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 100 });
