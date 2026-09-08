import paramiko

HOST = '31.128.38.54'
USER = 'root'
PASS = 'QJC9B1Um!BPa'
PROJECT = '/opt/checklist'

commands = [
    f'cd {PROJECT} && git pull',
    f'cd {PROJECT} && docker compose -f docker-compose.prod.yml build --no-cache client',
    f'cd {PROJECT} && docker compose -f docker-compose.prod.yml up -d client',
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)

for cmd in commands:
    print(f'\n>>> {cmd}')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=600)
    out = stdout.read().decode()
    err = stderr.read().decode()
    exit_code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.strip()[-2000:])
    if err.strip():
        print(f'STDERR: {err.strip()[-1000:]}')
    print(f'Exit code: {exit_code}')

client.close()
print('\n✅ Готово!')
