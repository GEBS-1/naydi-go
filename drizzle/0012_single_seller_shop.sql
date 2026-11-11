-- One social account can own one organization, including a draft or hidden store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_single_social_owner
ON shops(owner)
WHERE owner LIKE 'telegram:%' OR owner LIKE 'max:%';
