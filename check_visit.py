import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('31.128.38.54', username='root', password='QJC9B1Um!BPa', timeout=30)

VISIT_ID = '0264d700-1cc2-4333-b22a-03b56783891d'

queries = [
    (
        "1. Tasks in visit",
        f"""SELECT t.id, t.task_type, t.object_equipment_id, t.brand, t.model, t.serial_number, t.parameters, et.name as eq_name, et.code as eq_code FROM tasks t LEFT JOIN equipment_types et ON t.equipment_type_id = et.id WHERE t.visit_id = '{VISIT_ID}' ORDER BY t.sort_order;"""
    ),
    (
        "2. ObjectEquipment for tasks",
        f"""SELECT oe.id, oe.equipment_type_code, oe.brand, oe.model, oe.serial_number, oe.room_type_code FROM object_equipment oe WHERE oe.id IN (SELECT t.object_equipment_id FROM tasks t WHERE t.visit_id = '{VISIT_ID}' AND t.object_equipment_id IS NOT NULL);"""
    ),
]

for label, query in queries:
    print(f'\n=== {label} ===')
    cmd = f'docker compose -f /opt/checklist/docker-compose.prod.yml exec -T db psql -U postgres -d checklist -c "{query}"'
    i, o, e = c.exec_command(cmd, timeout=30)
    out = o.read().decode().strip()
    err = e.read().decode().strip()
    print(out if out else err if err else '(empty)')

c.close()
