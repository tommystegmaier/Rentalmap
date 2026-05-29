-- Add Cash App as a first-class payment method so P2P claims (and manual
-- entries) can be recorded with method = 'cashapp'.
-- Isolated in its own migration: Postgres requires ALTER TYPE ... ADD VALUE
-- to be committed before the new value can be used.
alter type payment_method add value if not exists 'cashapp';
