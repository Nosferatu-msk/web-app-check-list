import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd) {
  return new Promise((res, rej) => {
    console.log(`>>> ${cmd}`);
    conn.exec(cmd, (err, s) => {
      if (err) return rej(err);
      s.on('data', d => process.stdout.write(d));
      s.stderr.on('data', d => process.stderr.write(d));
      s.on('close', c => { console.log(`<<< exit: ${c}`); res(c); });
    });
  });
}
conn.on('ready', async () => {
  console.log('=== Очистка места ===');
  // Останавливаем зависшую сборку
  await exec('kill $(pgrep -f "docker compose.*build") 2>/dev/null; sleep 2');
  // Чистим Docker
  await exec('docker system prune -f');
  await exec('docker builder prune -f');
  // Удаляем старые образы
  await exec('docker images | grep "<none>" | awk \'{print $3}\' | xargs -r docker rmi -f');
  // Проверяем место
  await exec('df -h /');
  await exec('docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}"');
  console.log('\n=== Пересборка ===');
  await exec('cd /opt/checklist && docker compose -f docker-compose.prod.yml build server > /tmp/build3.log 2>&1 &');
  console.log('Сборка запущена в фоне');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
