ALTER TABLE products ADD COLUMN normalized_name TEXT;
ALTER TABLE products ADD COLUMN source_type TEXT;
ALTER TABLE products ADD COLUMN source_url TEXT;
ALTER TABLE products ADD COLUMN checked_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_products_normalized_name ON products(normalized_name);
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source_type,source_url);
