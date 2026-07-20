-- A Venmo/P2P payment claim can now include outstanding late fees. We store
-- the fee portion (for a clean rent ledger — rent_payments records rent only)
-- and the ids of the fees covered so they can be marked paid on approval.
alter table public.venmo_payment_claims
  add column if not exists late_fees_cents bigint not null default 0,
  add column if not exists late_fee_ids uuid[] not null default '{}';
