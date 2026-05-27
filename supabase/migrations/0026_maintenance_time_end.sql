-- Add scheduled_time_end to maintenance_events if not already present
-- (The column was introduced after the initial table creation)
alter table public.maintenance_events
  add column if not exists scheduled_time_end time;
