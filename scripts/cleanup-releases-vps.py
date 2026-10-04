import importlib.util,pathlib
spec=importlib.util.spec_from_file_location('v',pathlib.Path(__file__).with_name('vps-naydi.py'));v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
client=v.connect()
try:
 v.run(client,"""python3 - <<'PY'
import pathlib,re,shutil,json
root=pathlib.Path('/var/www/naydi-app').resolve(); releases=(root/'releases').resolve(); start=(root/'start.sh').read_text()
assert releases.parent==root
active=[]
for p in releases.iterdir():
 if p.is_dir() and str(p.resolve()) in start:active.append(p.resolve())
assert len(active)==1
target=(releases/'20260929T110626Z').resolve()
assert target.parent==releases and re.fullmatch(r'20260929T110626Z',target.name) and target!=active[0] and target.exists()
shutil.rmtree(target)
archive=(active[0]/'source.tar.gz').resolve()
if archive.exists():
 assert archive.parent==active[0]
 archive.unlink()
print(json.dumps({'removed_incomplete_release':str(target),'removed_active_source_archive':str(archive),'active':str(active[0]),'rollback_releases':[p.name for p in releases.iterdir() if p.is_dir() and p.resolve()!=active[0]]}))
PY""")
finally:client.close()
