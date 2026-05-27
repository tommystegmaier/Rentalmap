-- Add end-time to maintenance events so a service window can be shown as a range.
alter table public.maintenance_events
  add column if not exists scheduled_time_end time;
