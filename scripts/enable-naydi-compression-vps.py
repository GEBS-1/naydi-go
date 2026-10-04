"""Enable compression only in NaydiGo's static asset location."""
from pathlib import Path
import importlib.util,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace');sys.stderr.reconfigure(encoding='utf-8',errors='replace')
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('vps',ROOT/'scripts/vps-naydi.py');vps=importlib.util.module_from_spec(spec);spec.loader.exec_module(vps)
client=vps.connect()
try:
 vps.run(client,r"""python3 - <<'PY'
import pathlib,shutil,subprocess,time
site=pathlib.Path('/etc/nginx/sites-available/naydi-prepromo').resolve()
assert site==pathlib.Path('/etc/nginx/sites-available/naydi-prepromo')
text=site.read_text();needle='  location ^~ /_next/static/ {\n'
assert text.count(needle)==1
settings='''    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 5;
    gzip_types application/javascript text/css application/json image/svg+xml;
'''
if 'gzip_types application/javascript' not in text:
 backup=site.with_name(site.name+'.bak-gzip-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()));shutil.copy2(site,backup)
 site.write_text(text.replace(needle,needle+settings,1))
 try:subprocess.run(['nginx','-t'],check=True)
 except Exception:shutil.copy2(backup,site);raise
 subprocess.run(['systemctl','reload','nginx'],check=True);print('NAYDIGO_GZIP_ENABLED',backup)
else:subprocess.run(['nginx','-t'],check=True);print('NAYDIGO_GZIP_ALREADY_ENABLED')
PY
asset=$(find /var/www/naydi-app/current/dist/client/_next/static/chunks -maxdepth 1 -type f -size +100k | head -1); name=$(basename "$asset")
curl --compressed --fail --silent --show-error -o /dev/null -w "COMPRESSED_HTTP:%{http_code} TRANSFER:%{size_download} TIME:%{time_total}\n" "https://naydigo.prepromo.ru/_next/static/chunks/$name"
""")
finally:client.close()
