DROP INDEX IF EXISTS idx_shops_single_social_owner;
CREATE UNIQUE INDEX idx_shops_single_social_owner ON shops(owner) WHERE owner LIKE 'telegram:%' OR owner LIKE 'max:%' OR owner LIKE 'vk:%';
