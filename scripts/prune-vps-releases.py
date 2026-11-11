"""Install the scoped retention helper and run a dry plan, or --apply explicitly."""
import contextlib,datetime,importlib.util,io,json,pathlib,re,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
root=pathlib.Path(__file__).resolve().parent.parent
s=importlib.util.spec_from_file_location('v',root/'scripts/vps-naydi.py');v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
assert sys.argv[1:] in [[],['--apply']],'Usage: prune-vps-releases.py [--apply]'
c=v.connect();sftp=c.open_sftp()
try:
 remote='/var/www/naydi-app/maintenance/prune-releases.py'
 v.run(c,'mkdir -p /var/www/naydi-app/maintenance')
 sftp.put(str(root/'scripts/prune-naydi-releases.py'),remote);sftp.chmod(remote,0o600)
 with sftp.open('/var/www/naydi-app/maintenance/retention.json','w') as policy:
  policy.write(json.dumps({'keepWorkingReleases':1,'cleanupAfter':'successful startup and HTTPS check','preserve':['database','uploads','data backups']},indent=2))
 sftp.chmod('/var/www/naydi-app/maintenance/retention.json',0o600)
 current=sftp.normalize('/var/www/naydi-app/current')
 match=re.fullmatch(r'/var/www/naydi-app/releases/(\d{8}T\d{6}Z)',current);assert match,'Unexpected current release'
 command='python3 '+remote+' --expect-release '+match[1]+(' --apply' if '--apply' in sys.argv else '')
 output=io.StringIO()
 with contextlib.redirect_stdout(output):v.run(c,command)
 text=output.getvalue();print(text,end='');result=json.loads(text)
 directory=root/'artifacts/storage';directory.mkdir(parents=True,exist_ok=True)
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 path=directory/(('cleanup-' if result['apply'] else 'cleanup-plan-')+stamp+'.json');path.write_text(json.dumps(result,indent=2),encoding='utf-8')
 print('REPORT',path)
finally:sftp.close();c.close()
