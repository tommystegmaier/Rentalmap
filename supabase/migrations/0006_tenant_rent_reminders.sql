-- Landlord preference: send tenants a push reminder N days before rent is due.
alter table public.users
  add column if not exists tenant_rent_reminder_enabled boolean not null default true,
  add column if not exists tenant_rent_reminder_days_before smallint not null default 3
    check (tenant_rent_reminder_days_before between 0 and 14);
