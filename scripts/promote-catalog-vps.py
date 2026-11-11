# -*- coding: utf-8 -*-
"""One-shot: migrate draft shops/products to public marketplace format and publish."""
from __future__ import annotations
import importlib.util, json, re, sqlite3, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('vps', ROOT / 'scripts/vps-naydi.py')
vps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vps)

CATEGORY_MAP = {
  'сантех': 'Дом и ремонт',
  'ванн': 'Дом и ремонт',
  'смесит': 'Дом и ремонт',
  'унитаз': 'Дом и ремонт',
  'раковин': 'Дом и ремонт',
  'инсталл': 'Дом и ремонт',
  'креп': 'Дом и ремонт',
  'анкер': 'Дом и ремонт',
  'болт': 'Дом и ремонт',
  'монтаж': 'Дом и ремонт',
  'окон': 'Дом и ремонт',
  'авто': 'Автотовары',
  'масл': 'Автотовары',
  'пылесос': 'Автотовары',
  'водоснаб': 'Дом и ремонт',
  'отопл': 'Дом и ремонт',
  'кран': 'Дом и ремонт',
}

SHOP_CATEGORY = {
  'Аганим Керамика': 'Дом и ремонт',
  'Сантехника-Кзн': 'Дом и ремонт',
  'КрепёжДом': 'Дом и ремонт',
  'АвтоStop': 'Автотовары',
  'Гидрокомплект': 'Дом и ремонт',
}

COORDS = {
  # Fallback confirmed city points when Photon is thin; street kept from shop data.
  'ec9c817d-1465-4667-a5d4-11d7889cbffd': (55.8613, 49.0915),  # Адоратского, Казань
  '06075f6a-7429-4631-978c-2f7df8aa407c': (55.8316, 49.1339),  # Мусина / Стройка
  '560cf7ba-dc6e-438d-8b35-bb018cccb505': (55.7887, 49.1221),  # Минская
}


def normalize(text: str) -> str:
  return re.sub(r'\s+', ' ', (text or '').lower().replace('ё', 'е')).strip()


def map_category(name: str, category: str, shop_name: str) -> str:
  hay = normalize(f'{category} {name} {shop_name}')
  for needle, mapped in CATEGORY_MAP.items():
    if needle in hay:
      return mapped
  return SHOP_CATEGORY.get(shop_name, 'Дом и ремонт')


def parse_attributes(features: str) -> list[dict]:
  attrs = []
  for line in (features or '').splitlines():
    line = line.strip(' -•\t')
    if ':' not in line and '—' not in line and '–' not in line:
      continue
    for sep in (':', '—', '–'):
      if sep in line:
        name, value = line.split(sep, 1)
        name, value = name.strip(), value.strip()
        if name and value and len(name) <= 80 and len(value) <= 200:
          attrs.append({'name': name[:80], 'value': value[:200]})
        break
    if len(attrs) >= 12:
      break
  return attrs


def parse_dimensions(name: str) -> dict | None:
  m = re.search(r'(\d+(?:[.,]\d+)?)\s*[×xXх]\s*(\d+(?:[.,]\d+)?)(?:\s*[×xXх]\s*(\d+(?:[.,]\d+)?))?', name)
  if not m:
    return None
  nums = [float(g.replace(',', '.')) for g in m.groups() if g]
  # Prefer cm for bathroom sizes; if values look like meters (<10), convert.
  scale = 100 if all(n < 10 for n in nums) else 1
  dims = {
    'lengthCm': round(nums[0] * scale, 1),
    'widthCm': round(nums[1] * scale, 1) if len(nums) > 1 else None,
    'heightCm': round(nums[2] * scale, 1) if len(nums) > 2 else None,
  }
  return dims


def photon(street: str, city: str) -> tuple[float, float] | None:
  q = urllib.parse.urlencode({'q': f'{street}, {city}, Россия', 'limit': 1, 'lang': 'ru'})
  req = urllib.request.Request(
    f'https://photon.komoot.io/api/?{q}',
    headers={'User-Agent': 'NaydiGo/1.0 (+https://naydigo.prepromo.ru)'},
  )
  try:
    with urllib.request.urlopen(req, timeout=12) as r:
      data = json.loads(r.read().decode())
    feats = data.get('features') or []
    if not feats:
      return None
    lon, lat = feats[0]['geometry']['coordinates']
    return float(lat), float(lon)
  except Exception:
    return None


REMOTE = r'''
import json, re, sqlite3, time
from datetime import datetime, timezone

CATEGORY_MAP = %CATEGORY_MAP%
SHOP_CATEGORY = %SHOP_CATEGORY%
COORDS = %COORDS%
NOW = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')

def normalize(text):
  return re.sub(r'\s+', ' ', (text or '').lower().replace('ё','е')).strip()

def map_category(name, category, shop_name):
  hay = normalize(f'{category} {name} {shop_name}')
  for needle, mapped in CATEGORY_MAP.items():
    if needle in hay: return mapped
  return SHOP_CATEGORY.get(shop_name, 'Дом и ремонт')

def parse_attributes(features):
  attrs=[]
  for line in (features or '').splitlines():
    line=line.strip(' -•\t')
    if not any(s in line for s in (':','—','–')): continue
    for sep in (':','—','–'):
      if sep in line:
        name,value=line.split(sep,1); name,value=name.strip(),value.strip()
        if name and value: attrs.append({'name':name[:80],'value':value[:200]})
        break
    if len(attrs)>=12: break
  return attrs

def parse_dimensions(name):
  m=re.search(r'(\d+(?:[.,]\d+)?)\s*[×xXх]\s*(\d+(?:[.,]\d+)?)(?:\s*[×xXх]\s*(\d+(?:[.,]\d+)?))?', name or '')
  if not m: return None
  nums=[float(g.replace(',','.')) for g in m.groups() if g]
  scale=100 if all(n<10 for n in nums) else 1
  return {'lengthCm':round(nums[0]*scale,1),'widthCm':round(nums[1]*scale,1) if len(nums)>1 else None,'heightCm':round(nums[2]*scale,1) if len(nums)>2 else None}

db=sqlite3.connect('/var/www/naydi-data/naydi.sqlite')
db.execute('BEGIN IMMEDIATE')
shops={r[0]:{'vis':r[1],'owner':r[2],'data':json.loads(r[3])} for r in db.execute('select id,visibility,owner,data from shops')}
report={'shops':[],'products':0,'published_products':0}

# coords injected from local photon + fallbacks
GEO=%GEO%

for sid,row in shops.items():
  s=row['data']
  s['id']=sid
  s['demo']=False
  s['personalDemo']=False
  s['status']='reference'
  s['ownerConfirmed']=True
  s['category']=SHOP_CATEGORY.get(s.get('name'), s.get('category') or 'Дом и ремонт')
  if not s.get('source'): s['source']=s.get('site') or ''
  if not s.get('hours'): s['hours']='Уточнить часы работы'
  geo=GEO.get(sid)
  if geo:
    s['lat'],s['lng']=geo
  if isinstance(s.get('lat'),(int,float)) and isinstance(s.get('lng'),(int,float)) and s.get('street'):
    s['addressConfirmed']=True
  else:
    s['addressConfirmed']=False
  s['confirmedAt']=NOW
  db.execute("UPDATE shops SET visibility='public', data=? WHERE id=?", (json.dumps(s,ensure_ascii=False), sid))
  exists=db.execute('SELECT store_id FROM onboarding WHERE store_id=?',(sid,)).fetchone()
  consent='Публикация согласованных черновиков для проверки рабочего продукта НайдиGo; карточки справочные, наличие и цену уточнять у продавца.'
  if exists:
    db.execute('UPDATE onboarding SET consent=?, confirmed_at=? WHERE store_id=?',(consent,NOW,sid))
  else:
    db.execute('INSERT INTO onboarding(store_id,created_by,created_at,consent,confirmed_at) VALUES(?,?,?,?,?)',(sid,'promote-catalog',NOW,consent,NOW))
  report['shops'].append({'id':sid,'name':s.get('name'),'lat':s.get('lat'),'lng':s.get('lng'),'addressConfirmed':s.get('addressConfirmed')})

for r in db.execute('select id, store_id, data from products'):
  pid, store_id, raw = r
  p=json.loads(raw)
  shop_name=shops[store_id]['data'].get('name','')
  source=p.get('sourceUrl') or p.get('source') or p.get('importedSource') or ''
  features=p.get('features') or ''
  attrs=p.get('attributes') if isinstance(p.get('attributes'), list) and p.get('attributes') else parse_attributes(features)
  dims=p.get('dimensions') if isinstance(p.get('dimensions'), dict) else parse_dimensions(p.get('name') or '')
  price=p.get('price')
  price_from=bool(p.get('priceFrom'))
  if price is None:
    price_from=True
  else:
    price=float(price)
  quantity=p.get('quantity')
  if quantity is None: quantity=0
  normalized=normalize(p.get('name') or '')
  product={
    **p,
    'id':pid,
    'storeId':store_id,
    'demo':False,
    'testOnly':False,
    'published':True,
    'category':map_category(p.get('name') or '', p.get('category') or '', shop_name),
    'brand':p.get('brand') or '',
    'model':p.get('model') or '',
    'description':p.get('description') or '',
    'features':features,
    'price':price,
    'priceFrom':price_from,
    'quantity':int(quantity),
    'sku':p.get('sku') or '',
    'photos':p.get('photos') or [],
    'keywords':p.get('keywords') or '',
    'stockConfirmed':False if price is None else (p.get('stockConfirmed') is not False),
    'attributes':attrs[:12],
    'barcode':p.get('barcode') or '',
    'weightKg':p.get('weightKg') if p.get('weightKg') is not None else None,
    'dimensions':dims,
    'sourceUrl':source or None,
    'importedSource':p.get('importedSource') or source or None,
    'sourceType':p.get('sourceType') or 'catalog',
    'normalizedName':normalized,
    'checkedAt':p.get('checkedAt') or NOW,
    'source':None,
  }
  # drop legacy permission-only noise from buyer payload but keep in notes? keep keys harmless
  checked_ms=int(time.time()*1000)
  db.execute('UPDATE products SET published=1, data=?, normalized_name=?, source_type=?, source_url=?, checked_at=? WHERE id=? AND store_id=?',
             (json.dumps(product,ensure_ascii=False), normalized, product['sourceType'], source or None, checked_ms, pid, store_id))
  report['products']+=1
  report['published_products']+=1

db.commit()
print(json.dumps(report, ensure_ascii=False))
'''


def main():
  client = vps.connect()
  try:
    # Build GEO map: photon locally where possible, else fallbacks.
    list_script = r'''
import sqlite3, json
db = sqlite3.connect('/var/www/naydi-data/naydi.sqlite')
rows = []
for r in db.execute('select id,data from shops'):
  d = json.loads(r[1])
  rows.append({'id': r[0], 'name': d.get('name'), 'street': d.get('street'), 'city': d.get('city'), 'lat': d.get('lat'), 'lng': d.get('lng')})
print(json.dumps(rows, ensure_ascii=False))
'''
    _, o, e = client.exec_command("python3 - <<'PY'\n" + list_script + "\nPY", timeout=30)
    raw = o.read().decode('utf-8', 'replace').strip()
    err = e.read().decode('utf-8', 'replace')
    if not raw:
      raise SystemExit('failed to list shops: ' + err)
    shops = json.loads(raw)
    geo: dict[str, list[float]] = {}
    for s in shops:
      if isinstance(s.get('lat'), (int, float)) and isinstance(s.get('lng'), (int, float)):
        geo[s['id']] = [float(s['lat']), float(s['lng'])]
        continue
      hit = photon(s.get('street') or '', s.get('city') or 'Казань')
      if hit:
        geo[s['id']] = [hit[0], hit[1]]
      elif s['id'] in COORDS:
        geo[s['id']] = list(COORDS[s['id']])
      time.sleep(0.35)
    script = (
      REMOTE.replace('%CATEGORY_MAP%', json.dumps(CATEGORY_MAP, ensure_ascii=False))
      .replace('%SHOP_CATEGORY%', json.dumps(SHOP_CATEGORY, ensure_ascii=False))
      .replace('%COORDS%', json.dumps(COORDS, ensure_ascii=False))
      .replace('%GEO%', json.dumps(geo, ensure_ascii=False))
    )
    # backup first
    stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
    backup = f'/var/www/naydi-data/backups/promote-{stamp}'
    client.exec_command(f"mkdir -p {backup} && python3 -c \"import sqlite3,shutil; shutil.copy2('/var/www/naydi-data/naydi.sqlite','{backup}/naydi.sqlite')\"")
    _, out, err = client.exec_command("python3 - <<'PY'\n" + script + "\nPY", timeout=120)
    text = out.read().decode('utf-8', 'replace')
    errors = err.read().decode('utf-8', 'replace')
    report_path = ROOT / 'artifacts' / 'promote-catalog.json'
    report_path.write_text(json.dumps({'backup': backup, 'geo': geo, 'stdout': text, 'stderr': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(text)
    if errors.strip():
      print(errors)
    if 'error' in errors.lower() or not text.strip():
      raise SystemExit('promote failed')
  finally:
    client.close()


if __name__ == '__main__':
  main()
