#!/bin/bash
# Загрузка оборудования через админский импорт
# Запуск: scripts\load-equipment-manual.bat

echo ================================================================================
echo ЗАГРУЗКА ОБОРУДОВАНИЯ ЧЕРЕЗ АДМИНСКИЙ ИМПОРТ
echo ================================================================================
echo.

echo [1/5] Копирование файла на сервер...
scp -i C:\Users\Анна\.ssh\id_ed25519_checklist upload/import-equipment.xlsx root@31.128.38.54:/opt/checklist/server/scripts/
echo.

echo [2/5] Создание директории в контейнере...
ssh -i C:\Users\Анна\.ssh\id_ed25519_checklist root@31.128.38.54 "docker exec checklist-server-1 mkdir -p /app/server/scripts"
echo.

echo [3/5] Копирование файла в контейнер...
ssh -i C:\Users\Анна\.ssh\id_ed25519_checklist root@31.128.38.54 "docker cp /opt/checklist/server/scripts/import-equipment.xlsx checklist-server-1:/app/server/scripts/"
echo.

echo [4/5] Создание скрипта импорта...
ssh -i C:\Users\Анна\.ssh\id_ed25519_checklist root@31.128.38.54 "cat > /opt/checklist/server/scripts/import.mjs << 'EOF'
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const API_URL = 'http://localhost:3001/api/admin/import/object-equipment';
const FILE_PATH = '/app/server/scripts/import-equipment.xlsx';

async function getAdminToken() {
  const res = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
  });
  const data = await res.json();
  return data.accessToken;
}

async function importEquipment() {
  const token = await getAdminToken();
  console.log('Загрузка файла...');
  
  const form = new FormData();
  form.append('file', fs.createReadStream(FILE_PATH));
  
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: form
  });
  
  const result = await res.json();
  console.log('Результат:', JSON.stringify(result, null, 2));
}

importEquipment();
EOF"
echo.

echo [5/5] Копирование скрипта в контейнер и запуск...
ssh -i C:\Users\Анна\.ssh\id_ed25519_checklist root@31.128.38.54 "docker cp /opt/checklist/server/scripts/import.mjs checklist-server-1:/app/server/scripts/ && docker exec checklist-server-1 sh -c 'cd /app/server && node scripts/import.mjs'"
echo.

echo ================================================================================
echo ГОТОВО!
echo ================================================================================
