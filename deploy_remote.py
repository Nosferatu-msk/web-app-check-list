import paramiko
import sys

HOST = '31.128.38.54'
USER = 'root'
PASS = 'QJC9B1Um!BPa'
PROJECT = '/opt/checklist'

commands = [
    (f'cd {PROJECT} && git stash', False),
    (f'cd {PROJECT} && git pull', False),
    (f'cd {PROJECT} && docker compose -f docker-compose.prod.yml build', False),
    (f'cd {PROJECT} && docker compose -f docker-compose.prod.yml up -d', False),
    (f'cd {PROJECT} && sleep 5 && docker compose -f docker-compose.prod.yml exec -T server npx prisma migrate deploy', False),
    (f'cd {PROJECT} && docker compose -f docker-compose.prod.yml exec -T server npx tsx prisma/seed.ts', True),
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)

for cmd, optional in commands:
    print(f'\n>>> {cmd}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=600)
    out = stdout.read().decode()
    err = stderr.read().decode()
    exit_code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.strip()[-3000:])
    if err.strip():
        print(err.strip()[-1000:])
    if exit_code != 0:
        if optional:
            print(f'WARN (optional, exit code {exit_code})')
        else:
            print(f'ERROR (exit code {exit_code})')
            client.close()
            sys.exit(1)
    else:
        print(f'OK (exit code {exit_code})')

client.close()
print('\n✅ Деплой завершён!')
