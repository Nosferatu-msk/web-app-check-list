import { Client } from 'ssh2';
const conn = new Client();
function exec(cmd) {
  return new Promise((res, rej) => {
    console.log(`>>> ${cmd.slice(0, 120)}`);
    conn.exec(cmd, (err, s) => {
      if (err) return rej(err);
      let o = '';
      s.on('data', d => { o += d; process.stdout.write(d); });
      s.stderr.on('data', d => process.stderr.write(d));
      s.on('close', c => { console.log(`\n<<< exit: ${c}`); res({ c, o }); });
    });
  });
}
conn.on('ready', async () => {
  console.log('=== Повторный backfill с расширенным pHash ===\n');
  // Копируем скрипт
  await exec('docker exec checklist-server-1 mkdir -p /app/scripts');
  await exec('docker cp /opt/checklist/server/scripts/backfill-verification.ts checklist-server-1:/app/scripts/');
  // Удаляем старые отклонения чтобы пересоздать с новым алгоритмом
  await exec('docker exec checklist-server-1 npx prisma db execute --stdin <<< "DELETE FROM visit_anomalies;"');
  // Сбрасываем verification_status
  await exec('docker exec checklist-server-1 npx prisma db execute --stdin <<< "UPDATE photos SET verification_status = \'pending\', verification_details = NULL, phash = NULL;"');
  // Запускаем backfill
  console.log('\nЗапуск backfill...');
  await exec('docker exec checklist-server-1 npx tsx scripts/backfill-verification.ts');
  console.log('\n✅ Backfill завершён!');
  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
