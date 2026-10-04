import importlib.util,pathlib
spec=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
client=v.connect()
try:
 v.run(client,"""python3 - <<'PY'
import pathlib,os,shutil,json
root=pathlib.Path('/var/www/naydi-app').resolve(); releases=(root/'releases').resolve(); start=(root/'start.sh').read_text()
assert releases.parent==root
items=[]
for p in sorted(releases.iterdir()):
 if not p.is_dir():continue
 size=sum(f.stat().st_size for f in p.rglob('*') if f.is_file())
 items.append({'name':p.name,'bytes':size,'active':str(p.resolve()) in start})
print(json.dumps({'root':str(root),'releases':items,'disk_free':shutil.disk_usage(root).free,'inodes_free':os.statvfs(root).f_favail}))
PY""")
finally:client.close()
