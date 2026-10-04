"""Restore only the NaydiGo runtime and install its isolated boot service."""
from pathlib import Path
import importlib.util
import shlex
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("vps", ROOT / "scripts/vps-naydi.py")
vps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vps)

client = vps.connect()
try:
    _, stdout, _ = client.exec_command("command -v pm2", timeout=30)
    pm2 = stdout.read().decode().strip()
    if stdout.channel.recv_exit_status() or not pm2.startswith("/"):
        raise RuntimeError("PM2 executable not found")
    quoted_pm2 = shlex.quote(pm2)
    service = f"""[Unit]
Description=NaydiGo application
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=root
Environment=PM2_HOME=/root/.pm2
ExecStart=/bin/bash -lc '{quoted_pm2} describe naydigo >/dev/null 2>&1 && {quoted_pm2} restart naydigo --update-env || {quoted_pm2} start /var/www/naydi-app/start.sh --name naydigo --interpreter bash'
ExecReload=/bin/bash -lc '{quoted_pm2} restart naydigo --update-env'
ExecStop=/bin/bash -lc '{quoted_pm2} stop naydigo'
TimeoutStartSec=120
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
"""
    sftp = client.open_sftp()
    try:
        with sftp.open("/etc/systemd/system/naydigo.service", "w") as handle:
            handle.write(service)
        sftp.chmod("/etc/systemd/system/naydigo.service", 0o644)
    finally:
        sftp.close()
    vps.run(client, """set -e
test -x /var/www/naydi-app/start.sh
test -f /var/www/naydi-data/naydi.sqlite
systemctl daemon-reload
systemctl enable --now naydigo.service
python3 - <<'PY'
import json,time,urllib.request
for _ in range(40):
    try:
        with urllib.request.urlopen('http://127.0.0.1:3005/api/discovery',timeout=5) as response:
            data=json.load(response)
        assert isinstance(data,dict)
        print('LOCAL_DISCOVERY_OK',response.status)
        break
    except Exception:
        time.sleep(1)
else:
    raise RuntimeError('NaydiGo did not become healthy on port 3005')
PY
nginx -t
curl --fail --silent --show-error -o /dev/null -w 'HTTPS:%{http_code}\\n' https://naydigo.prepromo.ru/
systemctl is-enabled naydigo.service
systemctl is-active naydigo.service
pm2 describe naydigo | sed -n '1,30p'
ss -ltnp | grep ':3005'
""")
finally:
    client.close()
