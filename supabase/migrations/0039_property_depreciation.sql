-- Depreciation: persist the land allocation and recovery period so the tax
-- report can compute each year's deduction (mid-month convention, prorated
-- first year, and $0 once the recovery period ends).
alter table public.properties
  add column if not exists land_value_cents bigint,
  add column if not exists depreciation_years numeric(4, 1) not null default 27.5;
