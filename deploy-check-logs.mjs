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
  // Логи сервера — последние ошибки
  await exec('docker logs checklist-server-1 --tail 50 2>&1 | grep -i "error\\|reshoot\\|anomal"');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
