import paramiko
import json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('31.128.38.54', username='root', password='QJC9B1Um!BPa', timeout=30)

# Login and get token
cmd_login = """docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server sh -c "wget -qO- --post-data='{\\"email\\":\\"admin@example.com\\",\\"password\\":\\"admin123\\"}' --header='Content-Type: application/json' http://localhost:3001/api/auth/login" """
stdin, stdout, stderr = client.exec_command(cmd_login, timeout=30)
auth_raw = stdout.read().decode()
print('AUTH response:', auth_raw[:300])

try:
    token = json.loads(auth_raw)['accessToken']
except Exception as e:
    print(f'Failed to parse token: {e}')
    client.close()
    exit()

# Get first address with multiple rooms
cmd_addr = f"""docker compose -f /opt/checklist/docker-compose.prod.yml exec -T db psql -U checklist -t -c "SELECT a.id, a.full_address FROM addresses a JOIN object_equipment oe ON oe.address_id = a.id WHERE oe.is_active = true GROUP BY a.id, a.full_address HAVING COUNT(DISTINCT oe.room_type_code) > 1 LIMIT 1" """
stdin, stdout, stderr = client.exec_command(cmd_addr, timeout=30)
addr_raw = stdout.read().decode().strip()
print(f'\nAddress row: "{addr_raw}"')

# Parse address id
parts = addr_raw.split('|')
if len(parts) >= 1:
    addr_id = parts[0].strip()
    print(f'Address ID: {addr_id}')
else:
    print('No address found')
    client.close()
    exit()

# Get room types for this address
cmd_rooms = f"""docker compose -f /opt/checklist/docker-compose.prod.yml exec -T db psql -U checklist -t -c "SELECT DISTINCT oe.room_type_code, rt.name FROM object_equipment oe LEFT JOIN room_types rt ON rt.code = oe.room_type_code WHERE oe.address_id = '{addr_id}' AND oe.is_active = true AND oe.room_type_code IS NOT NULL" """
stdin, stdout, stderr = client.exec_command(cmd_rooms, timeout=30)
rooms_raw = stdout.read().decode().strip()
print(f'\nRooms:\n{rooms_raw}')

# Get first room code
first_room = rooms_raw.split('\n')[0].split('|')[0].strip() if rooms_raw else ''
print(f'\nFirst room code: "{first_room}"')

# Call other-rooms API
cmd_api = f"""docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server sh -c "wget -qO- --header='Authorization: Bearer {token}' 'http://localhost:3001/api/refs/object-equipment/other-rooms?address_id={addr_id}&current_room_type_code={first_room}'" """
print(f'\nCalling: GET /api/refs/object-equipment/other-rooms?address_id={addr_id}&current_room_type_code={first_room}')
stdin, stdout, stderr = client.exec_command(cmd_api, timeout=30)
api_raw = stdout.read().decode()
err_raw = stderr.read().decode()
print(f'API response ({len(api_raw)} chars): {api_raw[:500]}')
if err_raw:
    print(f'STDERR: {err_raw[:300]}')

# Also check server logs for errors
stdin, stdout, stderr = client.exec_command('docker logs checklist-server-1 --tail 10 2>&1', timeout=30)
print(f'\n=== LAST SERVER LOGS ===\n{stdout.read().decode()}')

client.close()
