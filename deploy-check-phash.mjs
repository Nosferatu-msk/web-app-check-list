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
  // Проверяем типы отклонений
  await exec('docker exec checklist-server-1 npx prisma db execute --stdin --schema /app/prisma/schema.prisma <<< "SELECT type, severity, count(*) FROM visit_anomalies GROUP BY type, severity ORDER BY count DESC;" 2>/dev/null || echo "trying alternative..."');

  // Альтернатива — через API
  const { o: tokenResp } = await exec(`curl -s -X POST https://checkonout.ru/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"admin123"}'`);
  const { accessToken } = JSON.parse(tokenResp);

  // Проверяем конкретные визиты которые указала Анна
  const { o: v1 } = await exec(`curl -s https://checkonout.ru/api/analytics/visits/855f9b8c-a27f-44b0-a1ee-6f8d515a04ad -H "Authorization: Bearer ${accessToken}"`);
  const d1 = JSON.parse(v1);
  console.log('\nВизит 855f9b8c (RU/77/607):');
  console.log('  Аномалий:', d1.anomalies?.length);
  d1.anomalies?.forEach((a) => console.log(`  - ${a.type} (${a.severity}): ${JSON.stringify(a.details).slice(0, 100)}`));

  const { o: v2 } = await exec(`curl -s https://checkonout.ru/api/analytics/visits/77131f20-3a52-4a65-a869-f9a3656a473f -H "Authorization: Bearer ${accessToken}"`);
  const d2 = JSON.parse(v2);
  console.log('\nВизит 77131f20:');
  console.log('  Аномалий:', d2.anomalies?.length);
  d2.anomalies?.forEach((a) => console.log(`  - ${a.type} (${a.severity}): ${JSON.stringify(a.details).slice(0, 100)}`));

  // Проверяем фото из этих визитов — какие phash
  if (d1.allPhotos) {
    console.log('\nФото визита 855f9b8c:');
    d1.allPhotos.forEach((p) => console.log(`  ${p.fileName}: phash=${p.phash?.slice(0,8)}... status=${p.verificationStatus}`));
  }
  if (d2.allPhotos) {
    console.log('\nФото визита 77131f20:');
    d2.allPhotos.forEach((p) => console.log(`  ${p.fileName}: phash=${p.phash?.slice(0,8)}... status=${p.verificationStatus}`));
  }

  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
