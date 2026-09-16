import paramiko

HOST = '31.128.38.54'
USER = 'root'
PASSWORD = 'QJC9B1Um!BPa'

LOCAL_SCRIPT = 'compute-photo-hashes.js'
REMOTE_SCRIPT = '/tmp/compute-photo-hashes.js'
CONTAINER_SCRIPT = '/app/compute-photo-hashes.js'

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
    return output

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD)

    sftp = ssh.open_sftp()
    sftp.put(LOCAL_SCRIPT, REMOTE_SCRIPT)
    sftp.close()
    print(f"✅ Скрипт загружен")

    run_command(ssh, f"docker cp {REMOTE_SCRIPT} checklist-server-1:{CONTAINER_SCRIPT}")

    print("\n=== ВЫПОЛНЕНИЕ ===\n")
    run_command(
        ssh,
        f"docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server node {CONTAINER_SCRIPT}"
    )

    run_command(ssh, f"docker compose -f /opt/checklist/docker-compose.prod.yml exec -T server rm -f {CONTAINER_SCRIPT}")
    run_command(ssh, f"rm -f {REMOTE_SCRIPT}")

    ssh.close()
    print("\n✅ Готово")

if __name__ == '__main__':
    main()
