import { Client } from 'ssh2';

const conn = new Client();

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (data) => process.stdout.write(data));
      stream.stderr.on('data', (data) => process.stderr.write(data));
      stream.on('close', (code) => { console.log(`\n<<< exit: ${code}`); resolve(code); });
    });
  });
}

conn.on('ready', async () => {
  console.log('SSH connected');
  try {
    // Используем nohup для сборки чтобы не зависеть от SSH keepalive
    await execCommand(conn, 'cd /opt/checklist && nohup docker compose -f docker-compose.prod.yml build server > /tmp/build.log 2>&1 && echo "BUILD_DONE" >> /tmp/build.log');

    // Проверяем результат
    await execCommand(conn, 'tail -5 /tmp/build.log');

    // Запускаем контейнеры
    await execCommand(conn, 'cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d');
    await execCommand(conn, 'cd /opt/checklist && docker compose -f docker-compose.prod.yml ps');
    console.log('\n✅ Деплой завершён!');
  } catch (err) { console.error('Error:', err); }
  finally { conn.end(); }
});

conn.on('error', (err) => { console.error('SSH error:', err.message); process.exit(1); });
conn.connect({
  host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa',
  keepaliveInterval: 10000, keepaliveCountMax: 10,
});
