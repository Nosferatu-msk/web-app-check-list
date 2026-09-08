import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('31.128.38.54', username='root', password='QJC9B1Um!BPa', timeout=30)

cmds = [
    'cd /opt/checklist && git pull origin main',
    'cd /opt/checklist && docker compose -f docker-compose.prod.yml build --no-cache client',
    'cd /opt/checklist && docker compose -f docker-compose.prod.yml up -d client',
]

for cmd in cmds:
    label = cmd if len(cmd) < 80 else cmd[:77] + '...'
    print(f'\n>>> {label}')
    i, o, e = c.exec_command(cmd, timeout=600)
    out = o.read().decode().strip()
    err = e.read().decode().strip()
    if out:
        print(out[-2000:])
    if err and 'warn' not in err.lower() and 'notice' not in err.lower():
        print(f'STDERR: {err[-500:]}')
    print(f'Exit: {o.channel.recv_exit_status()}')

c.close()
print('\n✅ Готово!')
