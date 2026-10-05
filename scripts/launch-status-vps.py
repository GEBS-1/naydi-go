import importlib.util,pathlib
s=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
c=v.connect()
try:
 v.run(c,"""python3 - <<'PY'
import sqlite3,shutil,json,pathlib
d=sqlite3.connect('file:/var/www/naydi-data/naydi.sqlite?mode=ro',uri=True)
for label,sql in [('accounts','SELECT provider,COUNT(*) FROM buyer_accounts GROUP BY provider'),('searches','SELECT status,COUNT(*) FROM buyer_searches GROUP BY status'),('payments','SELECT test,status,COUNT(*) FROM buyer_payments GROUP BY test,status'),('shops','SELECT visibility,COUNT(*) FROM shops GROUP BY visibility'),('budget','SELECT month,committed FROM api_budget ORDER BY month DESC LIMIT 2'),('unresolved','SELECT status,COUNT(*),SUM(reserved) FROM api_calls WHERE actual IS NULL GROUP BY status')]:print(label,json.dumps(d.execute(sql).fetchall()))
for raw, in d.execute('SELECT data FROM search_metrics ORDER BY created_at DESC LIMIT 2'):
 try:
  metric=json.loads(raw);print('recent_search',json.dumps({k:metric.get(k) for k in ['query','city','count','sources','warnings','usage','timing']},ensure_ascii=False))
 except Exception:pass
print('free_disk_mb',shutil.disk_usage('/var/www/naydi-app').free//1048576)
cfg={}
for line in pathlib.Path('/var/www/naydi-data/runtime.env').read_text().splitlines():
 if '=' in line:
  k,val=line.split('=',1)
  try:cfg[k]=json.loads(val)
  except:cfg[k]=val
print('access_admin_configured',bool(cfg.get('AUTH_ACCESS_ISSUER') and cfg.get('AUTH_ACCESS_AUD')))
print('buyer_admin_configured',bool(cfg.get('ADMIN_BUYER_ID') and cfg.get('ADMIN_EMAIL')))
PY""")
finally:c.close()
