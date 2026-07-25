import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('31.128.38.54', username='root', password='QJC9B1Um!BPa', timeout=30)

# Read lines 245-275 of compiled refs.js
stdin, stdout, stderr = client.exec_command(
    'docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server sed -n "245,275p" /app/dist/routes/refs.js',
    timeout=30
)
print('=== refs.js lines 245-275 ===')
print(stdout.read().decode())

# Get full error from logs
stdin, stdout, stderr = client.exec_command('docker logs checklist-server-1 --tail 30 2>&1', timeout=30)
print('\n=== FULL ERROR LOG ===')
print(stdout.read().decode())

client.close()
