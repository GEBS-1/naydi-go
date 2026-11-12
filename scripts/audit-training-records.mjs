import { DatabaseSync } from 'node:sqlite';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const directory = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
for (const filename of readdirSync(directory).filter(name => name.endsWith('.sqlite') && name !== 'metadata.sqlite')) {
  const db = new DatabaseSync(path.join(directory, filename), { readOnly: true });
  try {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='shops'").get()) continue;
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);
    const stores = db.prepare('SELECT id,data,visibility FROM shops ORDER BY id').all().map(row => {
      const data = JSON.parse(row.data);
      return { id: row.id, name: data.name, demo: data.demo ?? false, testOnly: data.testOnly ?? false, visibility: row.visibility, productCount: db.prepare('SELECT COUNT(*) AS n FROM products WHERE store_id=?').get(row.id).n };
    });
    const products = db.prepare('SELECT id,store_id,data,published FROM products ORDER BY store_id,id').all().map(row => {
      const data = JSON.parse(row.data);
      return { id: row.id, storeId: row.store_id, name: data.name, demo: data.demo ?? false, testOnly: data.testOnly ?? false, published: row.published };
    });
    const candidateStores = stores.filter(row => row.demo || row.testOnly || /^(demo-|qa-|test-)/i.test(row.id));
    const candidateIds = new Set(candidateStores.map(row => row.id));
    const candidates = products.filter(row => row.demo || row.testOnly || candidateIds.has(row.storeId) || /^(demo-|qa-|test-)/i.test(row.id));
    const related = {};
    for (const table of tables) {
      if (table === 'shops' || table === 'products') continue;
      const columns = db.prepare(`PRAGMA table_info("${table.replaceAll('"', '""')}")`).all().map(row => row.name);
      const storeColumn = columns.includes('store_id') ? 'store_id' : columns.includes('shop_id') ? 'shop_id' : null;
      const productColumn = columns.includes('product_id') ? 'product_id' : null;
      if (storeColumn) related[`${table}.${storeColumn}`] = candidateStores.flatMap(store => {
        const count = db.prepare(`SELECT COUNT(*) AS n FROM "${table.replaceAll('"', '""')}" WHERE "${storeColumn}"=?`).get(store.id).n;
        return count ? [{ storeId: store.id, count }] : [];
      });
      if (productColumn) related[`${table}.${productColumn}`] = candidates.flatMap(product => {
        const count = db.prepare(`SELECT COUNT(*) AS n FROM "${table.replaceAll('"', '""')}" WHERE "${productColumn}"=?`).get(product.id).n;
        return count ? [{ productId: product.id, count }] : [];
      });
    }
    console.log(JSON.stringify({ scope: 'local D1 only; read-only', file: filename, totals: { stores: stores.length, products: products.length }, candidateStores, candidateProducts: candidates, related }, null, 2));
  } finally { db.close(); }
}
