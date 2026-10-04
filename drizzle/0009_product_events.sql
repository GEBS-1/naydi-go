CREATE TABLE product_events (
 id TEXT PRIMARY KEY, event TEXT NOT NULL, city TEXT NOT NULL,
 category TEXT NOT NULL, day_actor TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX product_events_time ON product_events(created_at,event);
