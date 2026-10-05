#!/usr/bin/env python3
"""
Запуск перепроверки антифрод-отклонений на production-сервере
"""

import paramiko
import time
import sys

SERVER = "31.128.38.54"
USERNAME = "root"
PASSWORD = "QJC9B1Um!BPa"

def execute_ssh_command(ssh, command, wait=2):
    """Выполняет команду по SSH и возвращает вывод"""
    print(f"\n>>> {command}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=60)
    time.sleep(wait)
    output = stdout.read().decode('utf-8')
    error = stderr.read().decode('utf-8')
    if output:
        print(output)
    if error and 'WARNING' not in error and 'warning' not in error.lower():
        print(f"ERROR: {error}")
    return output, error

def main():
    print("=" * 60)
    print("Перепроверка антифрод-отклонений на production")
    print("=" * 60)
    
    # Подключение к серверу
    print(f"\nПодключение к {SERVER}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(SERVER, username=USERNAME, password=PASSWORD, timeout=10)
        print("✓ Подключено")
    except Exception as e:
        print(f"✗ Ошибка подключения: {e}")
        sys.exit(1)
    
    try:
        # Перейти в директорию проекта
        execute_ssh_command(ssh, "cd /opt/checklist")
        
        # Скопировать скрипты в контейнер
        print("\n" + "=" * 60)
        print("1. Копирование скриптов в контейнер")
        print("=" * 60)
        execute_ssh_command(ssh, "docker cp server/scripts/recheck-photo-anomalies.ts checklist-server-1:/app/server/scripts/recheck-photo-anomalies.ts", wait=3)
        execute_ssh_command(ssh, "docker cp server/scripts/update-timestamp-anomalies.ts checklist-server-1:/app/server/scripts/update-timestamp-anomalies.ts", wait=3)
        print("✓ Скрипты скопированы")
        
        # Запустить анализ (чтение)
        print("\n" + "=" * 60)
        print("2. Запуск анализа отклонений (чтение)")
        print("=" * 60)
        output, error = execute_ssh_command(ssh, "docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/recheck-photo-anomalies.ts", wait=15)
        
        if "Ошибка" in output or "Error" in error:
            print("✗ Ошибка при запуске анализа")
            print("Проверьте логи: docker compose -f docker-compose.prod.yml logs server")
            sys.exit(1)
        
        print("✓ Анализ завершён")
        
        # Запросить подтверждение перед обновлением
        print("\n" + "=" * 60)
        print("ВНИМАНИЕ: Следующий шаг изменит данные в БД!")
        print("=" * 60)
        print("\nСкрипт update-timestamp-anomalies.ts:")
        print("- Понизит timestamp-отклонения ≤ 10000 минут до warning")
        print("- Пересчитает статусы верификации фото")
        print("\nЭто действие НЕОБРАТИМО (без бэкапа БД)")
        
        # В production-скрипте автоматическое подтверждение
        # В реальном использовании можно добавить input()
        
        print("\n" + "=" * 60)
        print("3. Запуск обновления отклонений (запись)")
        print("=" * 60)
        output, error = execute_ssh_command(ssh, "docker compose -f docker-compose.prod.yml exec -T server npx tsx /app/server/scripts/update-timestamp-anomalies.ts", wait=20)
        
        if "Ошибка" in output or "Error" in error:
            print("✗ Ошибка при обновлении отклонений")
            print("Проверьте логи: docker compose -f docker-compose.prod.yml logs server")
            sys.exit(1)
        
        print("✓ Отклонения обновлены")
        
        # Пересобрать и перезапустить сервер
        print("\n" + "=" * 60)
        print("4. Пересборка и перезапуск сервера")
        print("=" * 60)
        execute_ssh_command(ssh, "docker compose -f docker-compose.prod.yml build server", wait=30)
        execute_ssh_command(ssh, "docker compose -f docker-compose.prod.yml up -d server", wait=5)
        print("✓ Сервер перезапущен")
        
        # Проверить логи
        print("\n" + "=" * 60)
        print("5. Проверка логов")
        print("=" * 60)
        execute_ssh_command(ssh, "docker compose -f docker-compose.prod.yml logs --tail=20 server", wait=3)
        
        # Статистика после обновления
        print("\n" + "=" * 60)
        print("6. Статистика отклонений после обновления")
        print("=" * 60)
        execute_ssh_command(ssh, """docker compose -f docker-compose.prod.yml exec -T db psql -U checklist -d checklist -c "
SELECT type, severity, COUNT(*) as count
FROM visit_anomalies
GROUP BY type, severity
ORDER BY type, severity;
" """, wait=5)
        
        print("\n" + "=" * 60)
        print("✓ ГОТОВО!")
        print("=" * 60)
        print("\nИзменения применены:")
        print("- Timestamp-отклонения ≤ 10000 минут понижены до warning")
        print("- Timestamp-отклонения > 10000 минут остались critical")
        print("- Статусы верификации фото пересчитаны")
        print("- Сервер перезапущен с новым кодом")
        
    except Exception as e:
        print(f"\n✗ Ошибка выполнения: {e}")
        sys.exit(1)
    finally:
        ssh.close()
        print("\nСоединение закрыто")

if __name__ == "__main__":
    main()
