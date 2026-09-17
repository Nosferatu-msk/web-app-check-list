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
    await execCommand(conn, 'cd /opt/checklist && git pull');
    await execCommand(conn, 'cd /opt/checklist && docker compose -f docker-compose.prod.yml build server client');
    await execCommand(conn, 'cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d');
    console.log('\n✅ Деплой завершён!');
  } catch (err) { console.error('Error:', err); }
  finally { conn.end(); }
});

conn.on('error', (err) => { console.error('SSH error:', err.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa' });
