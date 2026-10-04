CREATE TABLE buyer_personal (
 buyer_id TEXT PRIMARY KEY REFERENCES buyer_accounts(id),
 data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
);
CREATE TABLE payment_audit (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL, status TEXT NOT NULL,
 test INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX payment_audit_order ON payment_audit(order_id,created_at);
