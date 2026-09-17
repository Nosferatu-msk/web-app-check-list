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
  console.log('Ожидание сборки сервера...');
  for (let i = 0; i < 40; i++) {
    const { o } = await exec('tail -2 /tmp/build3.log 2>/dev/null');
    const lastLine = o.trim().split('\n').pop() || '';
    process.stdout.write(`[${i+1}/40] ${lastLine.slice(-70)}\n`);
    if (o.includes('naming to docker.io') || o.includes('DONE') && o.includes('exporting')) {
      await new Promise(r => setTimeout(r, 15000));
      console.log('\n✅ Сборка завершена! Перезапуск...');
      await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d');
      const { o: ps } = await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml ps');
      console.log(ps);
      console.log('✅ Деплой полностью завершён!');
      conn.end();
      return;
    }
    await new Promise(r => setTimeout(r, 15000));
  }
  console.log('Таймаут. Проверьте: tail -5 /tmp/build3.log');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 60 });
