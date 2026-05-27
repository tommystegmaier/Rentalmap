-- Maintenance events: scheduled service / repair items for an appliance
create table if not exists public.maintenance_events (
  id               uuid primary key default gen_random_uuid(),
  appliance_id     uuid not null references public.appliances(id) on delete cascade,
  property_id      uuid not null references public.properties(id) on delete cascade,
  title            text not null,
  scheduled_date   date not null,
  scheduled_time   time,
  scheduled_time_end time,
  notes            text,
  completed_at     timestamptz,
  completed_by     uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

-- Configurable reminders per maintenance event
create table if not exists public.maintenance_reminders (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.maintenance_events(id) on delete cascade,
  days_before      int not null check (days_before >= 0 and days_before <= 365),
  notify_landlord  boolean not null default true,
  notify_tenant    boolean not null default false,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- Indexes
create index if not exists maintenance_events_appliance_id_idx on public.maintenance_events(appliance_id);
create index if not exists maintenance_events_property_id_idx on public.maintenance_events(property_id);
create index if not exists maintenance_events_scheduled_date_idx on public.maintenance_events(scheduled_date);
create index if not exists maintenance_reminders_event_id_idx on public.maintenance_reminders(event_id);
create index if not exists maintenance_reminders_sent_at_idx on public.maintenance_reminders(sent_at) where sent_at is null;

-- RLS
alter table public.maintenance_events enable row level security;
alter table public.maintenance_reminders enable row level security;

-- Landlord: full access to events on their properties
create policy "landlord_maintenance_events_all"
  on public.maintenance_events
  for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = maintenance_events.property_id
        and p.owner_id = auth.uid()
    )
  );

-- Tenant: read access to events on their active lease's property
create policy "tenant_maintenance_events_read"
  on public.maintenance_events
  for select
  using (
    exists (
      select 1 from public.leases l
      join public.lease_tenants lt on lt.lease_id = l.id
      where l.property_id = maintenance_events.property_id
        and lt.user_id = auth.uid()
        and l.status = 'active'
    )
  );

-- Landlord: full access to reminders via event ownership
create policy "landlord_maintenance_reminders_all"
  on public.maintenance_reminders
  for all
  using (
    exists (
      select 1 from public.maintenance_events me
      join public.properties p on p.id = me.property_id
      where me.id = maintenance_reminders.event_id
        and p.owner_id = auth.uid()
    )
  );

-- Tenant: read access to reminders via active lease
create policy "tenant_maintenance_reminders_read"
  on public.maintenance_reminders
  for select
  using (
    exists (
      select 1 from public.maintenance_events me
      join public.leases l on l.property_id = me.property_id
      join public.lease_tenants lt on lt.lease_id = l.id
      where me.id = maintenance_reminders.event_id
        and lt.user_id = auth.uid()
        and l.status = 'active'
    )
  );
