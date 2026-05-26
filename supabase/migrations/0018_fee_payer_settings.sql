-- Adds per-landlord toggle columns so landlords can choose who absorbs
-- Stripe processing fees.  Defaults match the current hard-coded behaviour:
--   ACH ($0.80) → landlord absorbs
--   Card (2.9% + $0.30) → tenant pays

alter table public.users
  add column if not exists ach_fee_payer text not null default 'landlord'
    check (ach_fee_payer in ('landlord', 'tenant')),
  add column if not exists card_fee_payer text not null default 'tenant'
    check (card_fee_payer in ('landlord', 'tenant'));
