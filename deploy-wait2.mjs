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
  console.log('Ожидание завершения сборки...');
  for (let i = 0; i < 30; i++) {
    const { o } = await exec('tail -1 /tmp/build2.log 2>/dev/null || tail -1 /tmp/build.log');
    process.stdout.write(`[${i+1}] ${o.trim().slice(-80)}\n`);
    if (o.includes('BUILD_DONE') || o.includes('naming to docker.io') || o.includes('DONE')) {
      // Даём 10 сек на завершение
      await new Promise(r => setTimeout(r, 10000));
      console.log('\n✅ Сборка завершена! Перезапуск...');
      await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d');
      const { o: ps } = await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml ps');
      console.log(ps);
      console.log('✅ Деплой полностью завершён!');
      conn.end();
      return;
    }
    await new Promise(r => setTimeout(r, 20000));
  }
  console.log('Таймаут ожидания. Попробуйте вручную: docker compose -f docker-compose.prod.yml up -d');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 60 });
