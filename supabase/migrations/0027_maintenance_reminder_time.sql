-- Add send_time to maintenance_reminders so each reminder can fire at a
-- specific time of day (default 9:00 AM).
alter table public.maintenance_reminders
  add column if not exists send_time time not null default '09:00:00';
