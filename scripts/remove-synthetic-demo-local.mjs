import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const backup = process.argv[2];
if (!backup || !existsSync(path.join(backup, 'catalog.sqlite')) || !existsSync(path.join(backup, 'manifest.json'))) {
  throw new Error('Pass a verified local D1/R2 backup directory as the first argument');
}
const storeIds = ['demo-s0', 'demo-s1', 'demo-s2'];
const productIds = Array.from({ length: 30 }, (_, index) => `demo-p${index}`);
const directory = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const files = readdirSync(directory).filter(name => name.endsWith('.sqlite') && name !== 'metadata.sqlite');
for (const file of files) {
  const db = new DatabaseSync(path.join(directory, file));
  try {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='shops'").get()) continue;
    const stores = storeIds.map(id => db.prepare('SELECT id,owner,data FROM shops WHERE id=?').get(id));
    const products = productIds.map(id => db.prepare('SELECT id,store_id,data FROM products WHERE id=?').get(id));
    if (stores.some(row => !row || row.owner || JSON.parse(row.data).demo !== true)) throw new Error('Store identity/ownership check failed');
    if (products.some(row => !row || JSON.parse(row.data).demo !== true || !storeIds.includes(row.store_id))) throw new Error('Product identity check failed');
    for (const id of storeIds) {
      if (db.prepare('SELECT COUNT(*) AS n FROM products WHERE store_id=?').get(id).n !== 10) throw new Error(`Unexpected products for ${id}`);
      for (const table of ['claims', 'inquiries', 'onboarding', 'owner_invites', 'preview_tokens']) {
        if (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE store_id=?`).get(id).n) throw new Error(`Related ${table} rows for ${id}`);
      }
    }
    for (const id of productIds) {
      if (db.prepare('SELECT COUNT(*) AS n FROM favorites WHERE product_id=?').get(id).n) throw new Error(`Favorites exist for ${id}`);
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const id of productIds) db.prepare('DELETE FROM products WHERE id=?').run(id);
      for (const id of storeIds) db.prepare('DELETE FROM shops WHERE id=?').run(id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    console.log(JSON.stringify({ scope: 'local D1 only', removedStores: storeIds, removedProducts: productIds, remainingStores: db.prepare('SELECT COUNT(*) AS n FROM shops').get().n, remainingProducts: db.prepare('SELECT COUNT(*) AS n FROM products').get().n, integrity: db.prepare('PRAGMA integrity_check').get().integrity_check }));
  } finally { db.close(); }
}
