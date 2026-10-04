"""Print configuration presence only, never values."""
import importlib.util,pathlib
s=importlib.util.spec_from_file_location('vps',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
c=v.connect()
try:
 v.run(c,"""python3 - <<'PY'
import pathlib,json
cfg={}
for line in pathlib.Path('/var/www/naydi-data/runtime.env').read_text().splitlines():
 if '=' in line:
  key,value=line.split('=',1)
  try:cfg[key]=json.loads(value)
  except:cfg[key]=value
for key in ['YANDEX_CLIENT_ID','YANDEX_CLIENT_SECRET','YANDEX_AUTH_ENABLED']:
 print(key, 'configured' if cfg.get(key) else 'missing')
PY""")
finally:c.close()
