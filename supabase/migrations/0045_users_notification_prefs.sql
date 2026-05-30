-- Granular per-notification-type preferences for tenants.
-- Keys: rent_reminders, maintenance_updates, lease_signing,
--       inspection_signatures, messages. All default to on (true).
alter table public.users
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
