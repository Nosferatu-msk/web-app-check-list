import paramiko
import os

# Данные сервера
HOST = '31.128.38.54'
USER = 'root'
PASSWORD = 'QJC9B1Um!BPa'

# Локальный путь к скрипту
LOCAL_SCRIPT = 'diagnose-visit-photos.js'
REMOTE_SCRIPT = '/tmp/diagnose-visit-photos.js'
CONTAINER_SCRIPT = '/app/diagnose-visit-photos.js'

def run_command(ssh, cmd):
    print(f"\n>>> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_code = stdout.channel.recv_exit_status()
    output = stdout.read().decode('utf-8')
    error = stderr.read().decode('utf-8')
    if output:
        print(output)
    if error and exit_code != 0:
        print(f"ERROR: {error}")
    print(f"OK (exit code {exit_code})")
    return output, error, exit_code

def main():
    # Подключение к серверу
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD)

    # Загрузка скрипта на сервер
    sftp = ssh.open_sftp()
    sftp.put(LOCAL_SCRIPT, REMOTE_SCRIPT)
    sftp.close()
    print(f"✅ Скрипт загружен на {REMOTE_SCRIPT}")

    # Копирование в контейнер
    run_command(ssh, f"docker cp {REMOTE_SCRIPT} checklist-server-1:{CONTAINER_SCRIPT}")

    # Выполнение скрипта
    print("\n=== ВЫПОЛНЕНИЕ ДИАГНОСТИКИ ===\n")
    output, error, exit_code = run_command(
        ssh,
        f"docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server node {CONTAINER_SCRIPT}"
    )

    # Очистка
    run_command(ssh, f"docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server rm -f {CONTAINER_SCRIPT}")
    run_command(ssh, f"rm -f {REMOTE_SCRIPT}")

    ssh.close()
    print("\n✅ Диагностика завершена")

if __name__ == '__main__':
    main()
