-- How often the auto late fee is charged once rent is past the grace period:
--   once   — a single flat fee (default, existing behaviour)
--   weekly — the fee is charged again every 7 days it stays unpaid
--   daily  — the fee is charged for every day it stays unpaid
alter table public.leases
  add column if not exists late_fee_frequency text not null default 'once'
    check (late_fee_frequency in ('once', 'weekly', 'daily'));
