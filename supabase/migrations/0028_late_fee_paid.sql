-- Track late-fee payment separately from waiving. A fee can be:
--   outstanding  (waived = false, paid = false)
--   paid         (paid = true)   -- collected via Stripe or reconciled manually
--   waived       (waived = true) -- forgiven by the landlord
alter table public.late_fee_charges
  add column if not exists paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_payment_intent_id text;

create index if not exists late_fee_charges_paid_idx on public.late_fee_charges(paid);
