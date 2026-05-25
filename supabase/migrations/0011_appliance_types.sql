-- Per-appliance type templates: HVAC filter (dimensions, no model/serial/warranty)
-- and sprinkler system (spring start-up + winterize dates, no service interval).

alter table public.appliances
  add column if not exists appliance_type text not null default 'general'
    check (appliance_type in ('general', 'hvac_filter', 'sprinkler')),
  add column if not exists dimensions text,
  add column if not exists spring_startup_date date,
  add column if not exists winterize_date date;
