alter table public.properties
  add column if not exists market_rent_cents bigint,
  add column if not exists market_rent_fetched_at timestamptz;
