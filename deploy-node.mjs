import { Client } from 'ssh2';

const HOST = '31.128.38.54';
const USER = 'root';
const PASS = 'QJC9B1Um!BPa';
const PROJECT = '/opt/checklist';

const commands = [
  `cd ${PROJECT} && git pull`,
  `cd ${PROJECT} && docker compose -f docker-compose.prod.yml build`,
  `cd ${PROJECT} && docker compose -f docker-compose.prod.yml up -d`,
  `cd ${PROJECT} && sleep 5 && docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy`,
  `cd ${PROJECT} && docker compose -f docker-compose.prod.yml exec -T server npx tsx prisma/seed.ts`,
];

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connected\n');
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) {
      console.log('\n✅ ДЕПЛОЙ ЗАВЕРШЁН');
      conn.end();
      return;
    }
    const cmd = commands[idx++];
    console.log(`\n>>> [${idx}/${commands.length}] ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) { console.error('Exec error:', err.message); conn.end(); return; }
      let out = '', errOut = '';
      stream.on('data', d => { out += d.toString(); process.stdout.write(d); });
      stream.stderr.on('data', d => { errOut += d.toString(); process.stderr.write(d); });
      stream.on('close', (code) => {
        console.log(`\n<<< exit code: ${code}`);
        if (code !== 0 && idx < commands.length) {
          console.error('Command failed, stopping deploy');
          conn.end();
          return;
        }
        runNext();
      });
    });
  }
  runNext();
}).on('error', (err) => {
  console.error('SSH error:', err.message);
  process.exit(1);
}).connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
