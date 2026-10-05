#!/usr/bin/env python3
"""
Загрузка оборудования через админский импорт на production-сервере
"""

import paramiko
import sys
import os

print("=" * 80)
print("ЗАГРУЗКА ОБОРУДОВАНИЯ ЧЕРЕЗ АДМИНСКИЙ ИМПОРТ")
print("=" * 80)

# Подключение к серверу
SERVER = "31.128.38.54"
USERNAME = "root"
KEY_PATH = r"C:\Users\Анна\.ssh\id_ed25519_checklist"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER, username=USERNAME, key_filename=KEY_PATH, timeout=10)
print(f"\n✓ Подключено к {SERVER}")

# Копирование файла на сервер
print("\n" + "=" * 80)
print("КОПИРОВАНИЕ ФАЙЛА НА СЕРВЕР")
print("=" * 80)

local_file = "upload/import-equipment.xlsx"
remote_file = "/opt/checklist/server/scripts/import-equipment.xlsx"

sftp = ssh.open_sftp()
sftp.put(local_file, remote_file)
sftp.close()
print(f"\n✓ Файл скопирован: {remote_file}")

# Копирование файла в контейнер
print("\nКопирование файла в контейнер...")
mkdir_cmd = "docker exec checklist-server-1 mkdir -p /app/server/scripts"
ssh.exec_command(mkdir_cmd)
copy_cmd = "docker cp /opt/checklist/server/scripts/import-equipment.xlsx checklist-server-1:/app/server/scripts/import-equipment.xlsx"
stdin, stdout, stderr = ssh.exec_command(copy_cmd)
print(stdout.read().decode())
print("✓ Файл скопирован в контейнер")

# Создание Node.js скрипта для импорта
print("\n" + "=" * 80)
print("СОЗДАНИЕ СКРИПТА ИМПОРТА")
print("=" * 80)

import_script = """
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const API_URL = 'http://localhost:3001/api/admin/import/object-equipment';
const FILE_PATH = '/app/server/scripts/import-equipment.xlsx';

// Получаем токен админа
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
  try {
    console.log('Получение токена админа...');
    const token = await getAdminToken();
    console.log('✓ Токен получен');
    
    console.log('\\nЗагрузка файла...');
    const form = new FormData();
    form.append('file', fs.createReadStream(FILE_PATH));
    
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });
    
    if (!res.ok) {
      const error = await res.text();
      console.error('✗ Ошибка:', error);
      process.exit(1);
    }
    
    const result = await res.json();
    console.log('\\n✓ Импорт завершён!');
    console.log('\\nРезультат:');
    console.log(`  Всего строк: ${result.totalRows || result.total}`);
    console.log(`  Успешно: ${result.successRows || result.success}`);
    console.log(`  Дубликатов: ${result.duplicateRows || result.duplicates}`);
    console.log(`  Ошибок: ${result.errorRows || (result.errors ? result.errors.length : 0)}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\\nПервые 10 ошибок:');
      result.errors.slice(0, 10).forEach(err => {
        console.log(`  Строка ${err.row}: ${err.field} - ${err.message}`);
      });
    }
    
  } catch (err) {
    console.error('✗ Ошибка:', err.message);
    process.exit(1);
  }
}

importEquipment();
"""

# Запись скрипта на сервер
sftp = ssh.open_sftp()
with sftp.open('/opt/checklist/server/scripts/import-equipment.mjs', 'w') as f:
    f.write(import_script)
sftp.close()
print(f"\n✓ Скрипт импорта создан: /opt/checklist/server/scripts/import-equipment.mjs")

# Копирование скрипта в контейнер
copy_script_cmd = "docker cp /opt/checklist/server/scripts/import-equipment.mjs checklist-server-1:/app/server/scripts/import-equipment.mjs"
stdin, stdout, stderr = ssh.exec_command(copy_script_cmd)
print("✓ Скрипт скопирован в контейнер")

# Установка зависимостей
print("\n" + "=" * 80)
print("УСТАНОВКА ЗАВИСИМОСТЕЙ")
print("=" * 80)

install_cmd = """
cd /opt/checklist/server && npm list node-fetch > /dev/null 2>&1 || npm install node-fetch form-data
"""
stdin, stdout, stderr = ssh.exec_command(install_cmd)
print(stdout.read().decode())

# Запуск импорта
print("\n" + "=" * 80)
print("ЗАПУСК ИМПОРТА")
print("=" * 80)

import_cmd = """
docker exec checklist-server-1 sh -c "cd /app/server && node scripts/import-equipment.mjs"
"""
stdin, stdout, stderr = ssh.exec_command(import_cmd, timeout=300)
output = stdout.read().decode()
error = stderr.read().decode()

print(output)
if error:
    print("\nОшибки:")
    print(error)

# Очистка временных файлов
print("\n" + "=" * 80)
print("ОЧИСТКА")
print("=" * 80)

cleanup_cmd = """
rm -f /opt/checklist/server/scripts/import-equipment.xlsx
rm -f /opt/checklist/server/scripts/import-equipment.mjs
"""
ssh.exec_command(cleanup_cmd)
print("✓ Временные файлы удалены")

ssh.close()

print("\n" + "=" * 80)
print("ГОТОВО!")
print("=" * 80)
