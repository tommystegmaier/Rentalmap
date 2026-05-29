alter table public.reminders
  add column if not exists sent_at timestamptz;
