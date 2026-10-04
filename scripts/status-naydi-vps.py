"""Read-only runtime status for the NaydiGo process."""
from pathlib import Path
import importlib.util
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('vps', ROOT / 'scripts/vps-naydi.py')
vps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vps)

client = vps.connect()
try:
    vps.run(client, "pm2 describe naydigo | sed -n '1,45p'; printf '\\n--- boot and pm2 persistence ---\\n'; uptime -s; systemctl is-enabled pm2-root 2>&1 || true; systemctl is-active pm2-root 2>&1 || true; ls -l /root/.pm2/dump.pm2 2>&1 || true; grep -o '\"name\":\"naydigo\"' /root/.pm2/dump.pm2 2>/dev/null | head -1 || true; printf '\\n--- active node processes ---\\n'; ps -eo user,pid,lstart,args | grep -E '[n]ode .*3005|[v]inext.*3005' || true; printf '\\n--- active release ---\\n'; sed -n '1,8p' /var/www/naydi-app/start.sh; printf '\\n--- current client files ---\\n'; release=$(sed -n 's/^cd //p' /var/www/naydi-app/start.sh | head -1); find \"$release/dist/client/_next/static\" -maxdepth 2 -type f 2>/dev/null | tail -n 20; printf '\\n--- stale hash references ---\\n'; grep -R -l 'catalog-app-B7SoLwra' \"$release/dist\" 2>/dev/null | head -n 20 || true; printf '\\n--- nginx site ---\\n'; cat /etc/nginx/sites-available/naydi-prepromo; printf '\\n--- local root hash ---\\n'; curl -s http://127.0.0.1:3005/ | grep -o 'catalog-app-[A-Za-z0-9_-]*\\.js' | head -1; printf '\\n--- naydigo error log ---\\n'; tail -n 60 /root/.pm2/logs/naydigo-error.log 2>/dev/null || true; printf '\\n--- port 3005 ---\\n'; ss -ltnp | grep ':3005' || true")
finally:
    client.close()
