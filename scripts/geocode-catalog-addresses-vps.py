"""Read-only, rate-limited Photon audit for public Kazan catalog addresses."""
import importlib.util
import json
import pathlib
import sys

spec = importlib.util.spec_from_file_location('vps', pathlib.Path(__file__).with_name('vps-naydi.py'))
vps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vps)

client = vps.connect()
try:
    command = """python3 - <<'PY'
import json,re,time,urllib.parse,urllib.request
addresses=[
 ('Татметиз','ул. Фатыха Амирхана, 25, Казань'),
 ('Мега Крепеж','ул. Галимджана Баруди, 18, Казань'),
 ('Мега Крепеж','ул. Роторная, 1, Казань'),
 ('Novocraft','ул. Аделя Кутуя, 181Ж, Казань'),
 ('АвтоКрафт','ул. Аделя Кутуя, 72, Казань'),
 ('ГАЗЗАПЧАСТИ','Мамадышский тракт, 35 к1, Казань'),
 ('Makpets','ул. Техническая, 17, Казань'),
 ('MaiKorCos','ул. Петербургская, 25, Казань'),
 ('iStudio Kazan Mall','ул. Павлюхина, 91, Казань'),
 ('Velosky','пр. Победы, 100, Казань'),
 ('Velosky','ул. Маршала Чуйкова, 93, Казань'),
]
def norm(s):return ''.join(c.lower() for c in s if c.isalnum())
def street_norm(s):return norm(re.sub(r'^(?:ул\.?|улица|пр\.?|проспект|пер\.?|переулок|тракт)\s*','',s.strip(),flags=re.I))
results=[]
for i,(name,address) in enumerate(addresses):
 url='https://photon.komoot.io/api/?'+urllib.parse.urlencode({'q':address,'limit':5,'lang':'default','countrycode':'RU'})
 try:
  req=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'NaydiGo/1.0 (+https://naydigo.prepromo.ru)'})
  with urllib.request.urlopen(req,timeout=8) as response: body=json.loads(response.read().decode('utf-8'))
  candidates=[]
  for feature in body.get('features',[]):
   p=feature.get('properties',{});coordinates=feature.get('geometry',{}).get('coordinates',[])
   if len(coordinates)<2:continue
   label=', '.join(str(x) for x in [p.get('city'),p.get('street'),p.get('housenumber'),p.get('name')] if x)
   house=norm(str(p.get('housenumber') or ''))
   requested=norm(address.split(',')[1].strip()) if ',' in address else ''
   req_street=street_norm(address.split(',')[0])
   returned_street=street_norm(str(p.get('street') or ''))
   exact_house=bool(requested and house==requested)
   exact_street=bool(req_street and returned_street and (req_street==returned_street or req_street in returned_street or returned_street in req_street))
   exact_city=norm(str(p.get('city') or '')).find('казан')>=0
   candidates.append({'label':label,'lat':coordinates[1],'lng':coordinates[0],'houseMatch':exact_house,'streetMatch':exact_street,'cityMatch':exact_city,'osmType':p.get('osm_type'),'osmId':p.get('osm_id'),'osmValue':p.get('osm_value')})
  exact=[x for x in candidates if x['houseMatch'] and x['streetMatch'] and x['cityMatch']]
  results.append({'seller':name,'address':address,'exactHouseAndCity':len(exact)==1,'point':exact[0] if len(exact)==1 else None,'candidates':candidates[:3]})
 except Exception as e:results.append({'seller':name,'address':address,'error':type(e).__name__})
 if i+1<len(addresses):time.sleep(1.2)
print(json.dumps(results,ensure_ascii=True))
PY"""
    _, stdout, _ = client.exec_command(command, timeout=120)
    output = stdout.read().decode('utf-8')
    if stdout.channel.recv_exit_status():
        raise RuntimeError('Photon address audit failed.')
    results = json.loads(output)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(results, ensure_ascii=False))
finally:
    client.close()
