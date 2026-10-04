"""Serve only NaydiGo build assets directly through its existing Nginx site."""
from pathlib import Path
import importlib.util
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('vps',ROOT/'scripts/vps-naydi.py')
vps=importlib.util.module_from_spec(spec);spec.loader.exec_module(vps)
client=vps.connect()
try:
 vps.run(client,r"""python3 - <<'PY'
import pathlib,re,shutil,subprocess,time
app=pathlib.Path('/var/www/naydi-app').resolve()
site=pathlib.Path('/etc/nginx/sites-available/naydi-prepromo').resolve()
assert site==pathlib.Path('/etc/nginx/sites-available/naydi-prepromo')
start=(app/'start.sh').read_text()
match=re.search(r'^cd (/var/www/naydi-app/releases/\d{8}T\d{6}Z)$',start,re.M)
assert match,'Active NaydiGo release not found'
release=pathlib.Path(match.group(1)).resolve()
assert release.parent==(app/'releases').resolve() and (release/'dist/client/_next/static').is_dir()
current=app/'current';tmp=app/'current.next'
tmp.unlink(missing_ok=True);tmp.symlink_to(release,target_is_directory=True);tmp.replace(current)
text=site.read_text()
marker='location ^~ /_next/static/'
if marker not in text:
 block='''  location ^~ /_next/static/ {
    alias /var/www/naydi-app/current/dist/client/_next/static/;
    access_log off;
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
  }

'''
 needle='  location / {\n'
 assert text.count(needle)==1
 backup=site.with_name(site.name+'.bak-static-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()))
 shutil.copy2(site,backup)
 site.write_text(text.replace(needle,block+needle,1))
 try:subprocess.run(['nginx','-t'],check=True)
 except Exception:
  shutil.copy2(backup,site);raise
 subprocess.run(['systemctl','reload','nginx'],check=True)
 print('NAYDIGO_STATIC_ENABLED',release.name,backup)
else:
 subprocess.run(['nginx','-t'],check=True)
 print('NAYDIGO_STATIC_ALREADY_ENABLED',release.name)
PY
asset=$(find /var/www/naydi-app/current/dist/client/_next/static/chunks -maxdepth 1 -type f | head -1)
name=$(basename "$asset")
curl --fail --silent --show-error -o /dev/null -w "STATIC_HTTP:%{http_code} STATIC_TIME:%{time_total}\n" "https://naydigo.prepromo.ru/_next/static/chunks/$name"
""")
finally:client.close()
