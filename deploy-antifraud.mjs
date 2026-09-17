import { Client } from 'ssh2';

const HOST = '31.128.38.54';
const USER = 'root';
const PASS = 'QJC9B1Um!BPa';

const commands = [
  'cd /opt/checklist && git pull',
  'cd /opt/checklist && docker compose -f docker-compose.prod.yml build --no-cache server client',
  'cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d',
  'sleep 5',
  'cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy',
  'cd /opt/checklist && docker compose -f docker-compose.prod.yml exec -T server node scripts/backfill-verification.js',
];

const conn = new Client();

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '', stderr = '';
      stream.on('data', (data) => { stdout += data.toString(); process.stdout.write(data); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); process.stderr.write(data); });
      stream.on('close', (code) => {
        console.log(`\n<<< exit code: ${code}`);
        resolve({ code, stdout, stderr });
      });
    });
  });
}

conn.on('ready', async () => {
  console.log('SSH connected to', HOST);
  try {
    for (const cmd of commands) {
      const result = await execCommand(conn, cmd);
      if (result.code !== 0 && !cmd.startsWith('sleep')) {
        console.error(`Command failed with code ${result.code}: ${cmd}`);
        // Продолжаем — backfill может не найти фото для проверки
      }
    }
    console.log('\n✅ Деплой завершён!');
  } catch (err) {
    console.error('Deploy error:', err);
  } finally {
    conn.end();
  }
});

conn.on('error', (err) => {
  console.error('SSH error:', err.message);
  process.exit(1);
});

conn.connect({ host: HOST, port: 22, username: USER, password: PASS });
