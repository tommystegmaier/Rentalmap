-- Scheduled maintenance events per appliance with time-of-day and
-- per-event multi-recipient reminder schedule.

-- ── Tables ────────────────────────────────────────────────────────────────

create table public.maintenance_events (
  id               uuid primary key default gen_random_uuid(),
  appliance_id     uuid not null references public.appliances(id) on delete cascade,
  property_id      uuid not null references public.properties(id) on delete cascade,
  title            text not null,
  scheduled_date   date not null,
  scheduled_time   time,                       -- optional e.g. '09:00'
  notes            text,
  completed_at     timestamptz,
  completed_by     uuid references public.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index maintenance_events_appliance_idx on public.maintenance_events(appliance_id);
create index maintenance_events_property_idx  on public.maintenance_events(property_id);
create index maintenance_events_date_idx      on public.maintenance_events(scheduled_date);

-- One row per reminder trigger per event.
-- days_before=0 → fire on the day of the event.
create table public.maintenance_reminders (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.maintenance_events(id) on delete cascade,
  days_before      smallint not null default 1
    check (days_before >= 0 and days_before <= 365),
  notify_landlord  boolean not null default true,
  notify_tenant    boolean not null default true,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index maintenance_reminders_event_idx   on public.maintenance_reminders(event_id);
create index maintenance_reminders_unsent_idx  on public.maintenance_reminders(sent_at)
  where sent_at is null;

-- ── Row-level security ────────────────────────────────────────────────────

alter table public.maintenance_events    enable row level security;
alter table public.maintenance_reminders enable row level security;

-- Landlord: full access via property ownership
create policy "landlord_maintenance_events" on public.maintenance_events
  for all using (
    exists (
      select 1 from public.properties p
      where p.id = maintenance_events.property_id
        and p.owner_id = auth.uid()
    )
  );

-- Tenant: read-only for their active lease's property
create policy "tenant_read_maintenance_events" on public.maintenance_events
  for select using (
    exists (
      select 1 from public.leases l
      join public.lease_tenants lt on lt.lease_id = l.id
      where l.property_id = maintenance_events.property_id
        and lt.user_id  = auth.uid()
        and l.status    = 'active'
    )
  );

-- Landlord: full access on reminders (tenant never sees reminder config)
create policy "landlord_maintenance_reminders" on public.maintenance_reminders
  for all using (
    exists (
      select 1 from public.maintenance_events me
      join public.properties p on p.id = me.property_id
      where me.id = maintenance_reminders.event_id
        and p.owner_id = auth.uid()
    )
  );

-- ── Trigger ───────────────────────────────────────────────────────────────

create trigger maintenance_events_set_updated_at
  before update on public.maintenance_events
  for each row execute function public.set_updated_at();
