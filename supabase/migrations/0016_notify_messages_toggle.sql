-- 0016: add per-user toggle for message push notifications.
alter table public.users
  add column if not exists notify_messages boolean not null default true;
