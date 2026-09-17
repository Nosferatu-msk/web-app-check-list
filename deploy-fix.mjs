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
  console.log('=== Диагностика ===');
  // Проверяем зависшие build процессы
  await exec('docker ps -a --filter "status=created" --filter "status=running" | head -5');
  await exec('ps aux | grep "docker" | grep -v grep | head -5');
  // Проверяем логи
  await exec('wc -l /tmp/build.log /tmp/build2.log 2>/dev/null');
  await exec('tail -5 /tmp/build.log');
  await exec('tail -5 /tmp/build2.log 2>/dev/null');
  // Проверяем образ сервера
  await exec('docker images checklist-server --format "{{.ID}} {{.Size}} {{.CreatedAt}}"');
  // Текущий запущенный сервер
  await exec('docker inspect checklist-server-1 --format "{{.Image}}" 2>/dev/null');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
