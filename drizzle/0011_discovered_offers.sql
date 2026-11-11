CREATE TABLE discovered_offers (
  id TEXT PRIMARY KEY NOT NULL,
  city TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source_url TEXT NOT NULL,
  data TEXT NOT NULL,
  checked_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_discovered_city_source ON discovered_offers(city, source_key);
CREATE INDEX idx_discovered_city_checked ON discovered_offers(city, checked_at);
CREATE INDEX idx_discovered_checked ON discovered_offers(checked_at);
