import paramiko
import sys

HOST = '31.128.38.54'
USER = 'root'
PASS = 'QJC9B1Um!BPa'
PROJECT = '/opt/checklist'

commands = [
    f'cd {PROJECT} && git pull',
    # Resolve failed migration
    f'cd {PROJECT} && docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate resolve --rolled-back 20260725000000_add_moderation_fields_and_notifications',
    # Rebuild and restart
    f'cd {PROJECT} && docker compose -f docker-compose.prod.yml build',
    f'cd {PROJECT} && docker compose -f docker-compose.prod.yml up -d',
    # Apply migration
    f'cd {PROJECT} && sleep 5 && docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy',
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)

for cmd in commands:
    print(f'\n>>> {cmd}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
    out = stdout.read().decode()
    err = stderr.read().decode()
    exit_code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.strip())
    if err.strip():
        print(err.strip())
    if exit_code != 0:
        print(f'ERROR (exit code {exit_code})')
        client.close()
        sys.exit(1)
    print(f'OK (exit code {exit_code})')

client.close()
print('\n✅ Деплой завершён!')
