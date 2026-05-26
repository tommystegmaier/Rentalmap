-- 0012: in-app notifications + per-type toggles + maintenance-unread tracking.

-- Per-type push toggles. Default all on so existing users keep current behavior.
alter table public.users
  add column if not exists notify_appliance_service boolean not null default true,
  add column if not exists notify_hvac_filter boolean not null default true,
  add column if not exists notify_maintenance_requests boolean not null default true;

-- Notifications inbox — distinct from public.reminders. Reminders are scheduled
-- future triggers ("rent due in 3 days"); notifications are an event log of
-- things that already happened ("Matthew submitted a work order").
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  url text,
  related_id uuid,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id)
  where read_at is null and dismissed_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_self_all on public.notifications;
create policy notifications_self_all on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Track when the landlord first opened each work order so we can show an
-- unread badge on the Maintenance tab.
alter table public.work_orders
  add column if not exists landlord_viewed_at timestamptz;
