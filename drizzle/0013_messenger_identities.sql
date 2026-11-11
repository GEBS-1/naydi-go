CREATE TABLE IF NOT EXISTS buyer_identities(provider TEXT NOT NULL,subject TEXT NOT NULL,buyer_id TEXT NOT NULL REFERENCES buyer_accounts(id),created_at INTEGER NOT NULL,PRIMARY KEY(provider,subject));
INSERT OR IGNORE INTO buyer_identities(provider,subject,buyer_id,created_at) SELECT provider,subject,id,created_at FROM buyer_accounts;
CREATE INDEX IF NOT EXISTS buyer_identities_account ON buyer_identities(buyer_id);
ALTER TABLE buyer_logins ADD COLUMN link_buyer_id TEXT REFERENCES buyer_accounts(id);
ALTER TABLE buyer_sessions ADD COLUMN login_provider TEXT;
