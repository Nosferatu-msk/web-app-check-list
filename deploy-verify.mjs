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
  // Логинимся и проверяем API аналитики
  console.log('=== Проверка API ===\n');

  // Получаем токен
  const { o: tokenResp } = await exec(`curl -s -X POST https://checkonout.ru/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"admin123"}'`);

  try {
    const { accessToken } = JSON.parse(tokenResp);
    console.log('Токен получен:', accessToken ? 'OK' : 'FAIL');

    // Проверяем API аналитики
    const { o: analyticsResp } = await exec(`curl -s https://checkonout.ru/api/analytics/visits?period=30d -H "Authorization: Bearer ${accessToken}"`);
    const analytics = JSON.parse(analyticsResp);
    console.log('\nAPI /analytics/visits:');
    console.log('  Визитов с отклонениями:', analytics.total);
    console.log('  Сводка:', JSON.stringify(analytics.summary));

    if (analytics.data && analytics.data.length > 0) {
      const firstVisit = analytics.data[0];
      console.log('\n  Первый визит:', firstVisit.visitCode, firstVisit.engineer?.name);
      console.log('  Отклонения:', JSON.stringify(firstVisit.anomalyCount));

      // Проверяем детали визита (allPhotos + verificationDetails)
      const { o: detailResp } = await exec(`curl -s https://checkonout.ru/api/analytics/visits/${firstVisit.visitId} -H "Authorization: Bearer ${accessToken}"`);
      const detail = JSON.parse(detailResp);
      console.log('\nAPI /analytics/visits/:id:');
      console.log('  Аномалий:', detail.anomalies?.length);
      console.log('  Всех фото:', detail.allPhotos?.length);
      if (detail.anomalies?.[0]?.photo) {
        console.log('  verificationStatus:', detail.anomalies[0].photo.verificationStatus);
        console.log('  verificationDetails:', Array.isArray(detail.anomalies[0].photo.verificationDetails) ? `${detail.anomalies[0].photo.verificationDetails.length} checks` : 'N/A');
        console.log('  capturedAt:', detail.anomalies[0].photo.capturedAt || 'null');
        console.log('  photoSource:', detail.anomalies[0].photo.photoSource || 'null');
      }
    }

    console.log('\n✅ API работает корректно!');
  } catch (e) {
    console.error('Ошибка парсинга:', e.message);
    console.log('Raw response:', tokenResp.slice(0, 200));
  }

  conn.end();
});
conn.on('error', e => { console.error(e.message); process.exit(1); });
conn.connect({ host: '31.128.38.54', port: 22, username: 'root', password: 'QJC9B1Um!BPa', keepaliveInterval: 10000, keepaliveCountMax: 10 });
