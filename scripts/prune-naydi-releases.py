"""Delete only inactive NaydiGo code releases after an explicitly approved cleanup."""
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
    vps.run(client, r"""python3 - <<'PY'
import json,pathlib,re,shutil
app=pathlib.Path('/var/www/naydi-app').resolve()
releases=(app/'releases').resolve()
assert releases.parent==app and releases.name=='releases'
start=(app/'start.sh').read_text()
items=[]
for p in releases.iterdir():
    resolved=p.resolve()
    if not p.is_dir() or resolved.parent!=releases or not re.fullmatch(r'\d{8}T\d{6}Z',p.name):
        continue
    items.append(resolved)
active=[p for p in items if str(p) in start]
assert len(active)==1
inactive=sorted((p for p in items if p!=active[0]),key=lambda p:p.name,reverse=True)
# Keep exactly one last known release for an immediate code rollback.
rollback=inactive[:1]
remove=[p for p in inactive[1:] if p.parent==releases]
removed=[]
for p in remove:
    size=sum(f.stat().st_size for f in p.rglob('*') if f.is_file())
    shutil.rmtree(p)
    removed.append({'name':p.name,'bytes':size})
print(json.dumps({'active':active[0].name,'rollback_kept':rollback[0].name if rollback else None,'removed':removed,'free_bytes':shutil.disk_usage(app).free}))
PY""")
finally:
    client.close()
