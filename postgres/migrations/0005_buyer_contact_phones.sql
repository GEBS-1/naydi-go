CREATE TABLE buyer_contact_phones (
 buyer_id TEXT PRIMARY KEY REFERENCES buyer_accounts(id) ON DELETE CASCADE,
 phone TEXT NOT NULL,
 provider TEXT NOT NULL CHECK (provider IN ('telegram','max')),
 updated_at BIGINT NOT NULL
);
