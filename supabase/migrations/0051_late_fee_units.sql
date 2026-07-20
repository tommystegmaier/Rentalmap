-- For recurring (weekly/daily) late fees we keep a single charge row per rent
-- period and let it grow, rather than one row per day. `units` records how many
-- increments that row represents (e.g. 19 days) so amount_cents = units × fee
-- and further accrual can be added to the same row until it's paid or waived.
alter table public.late_fee_charges
  add column if not exists units integer not null default 1;
