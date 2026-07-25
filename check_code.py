import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('31.128.38.54', username='root', password='QJC9B1Um!BPa', timeout=30)

# Check if filter(Boolean) is in the compiled code
stdin, stdout, stderr = client.exec_command(
    'docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server grep -n "filter" /app/dist/routes/refs.js',
    timeout=30
)
print('=== filter in refs.js ===')
print(stdout.read().decode())

# Check if other-rooms route exists
stdin, stdout, stderr = client.exec_command(
    'docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server grep -n "other-rooms" /app/dist/routes/refs.js',
    timeout=30
)
print('=== other-rooms in refs.js ===')
print(stdout.read().decode())

# Try the API with verbose wget
stdin, stdout, stderr = client.exec_command(
    """docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server sh -c "wget -qO- --post-data='{\\"email\\":\\"admin@example.com\\",\\"password\\":\\"admin123\\"}' --header='Content-Type: application/json' http://localhost:3001/api/auth/login" """,
    timeout=30
)
import json
auth_raw = stdout.read().decode()
try:
    token = json.loads(auth_raw)['accessToken']
except:
    print('Auth failed:', auth_raw[:200])
    client.close()
    exit()

# Call other-rooms with verbose output
stdin, stdout, stderr = client.exec_command(
    f"""docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server sh -c "wget -S -O- --header='Authorization: Bearer {token}' 'http://localhost:3001/api/refs/object-equipment/other-rooms?address_id=003dbac4-14b2-4082-be82-68e7f52c75d0&current_room_type_code=electroshc' 2>&1" """,
    timeout=30
)
result = stdout.read().decode()
print(f'=== API other-rooms response ({len(result)} chars) ===')
print(result[:1000])

# Check server logs after the call
stdin, stdout, stderr = client.exec_command('docker logs checklist-server-1 --tail 5 2>&1', timeout=30)
print('\n=== LAST LOGS ===')
print(stdout.read().decode())

client.close()
