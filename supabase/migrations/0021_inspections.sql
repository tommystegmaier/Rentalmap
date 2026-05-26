-- Move-in / move-out / periodic inspection checklists with photo evidence.

create table public.inspections (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  lease_id        uuid references public.leases(id) on delete set null,
  type            text not null check (type in ('move_in', 'move_out', 'periodic')),
  conducted_date  date not null default current_date,
  conducted_by    uuid references public.users(id),
  overall_notes   text,
  tenant_signed_at   timestamptz,
  tenant_signed_by   uuid references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index inspections_property_idx on public.inspections(property_id);
create index inspections_lease_idx on public.inspections(lease_id);

create table public.inspection_items (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  room          text not null,
  item          text not null,
  condition     text not null default 'good'
    check (condition in ('excellent', 'good', 'fair', 'poor', 'damaged', 'na')),
  notes         text,
  photo_urls    text[] not null default array[]::text[],
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);

create index inspection_items_inspection_idx on public.inspection_items(inspection_id);

alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;

-- Landlord: full access.
create policy "landlord_inspections" on public.inspections
  for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = inspections.property_id
        and p.owner_id = auth.uid()
    )
  );

create policy "landlord_inspection_items" on public.inspection_items
  for all
  using (
    exists (
      select 1 from public.inspections i
      join public.properties p on p.id = i.property_id
      where i.id = inspection_items.inspection_id
        and p.owner_id = auth.uid()
    )
  );

-- Tenant: read inspections for their lease.
create policy "tenant_read_inspections" on public.inspections
  for select
  using (
    lease_id is not null and exists (
      select 1 from public.lease_tenants lt
      where lt.lease_id = inspections.lease_id
        and lt.user_id = auth.uid()
    )
  );

create policy "tenant_read_inspection_items" on public.inspection_items
  for select
  using (
    exists (
      select 1 from public.inspections i
      join public.lease_tenants lt on lt.lease_id = i.lease_id
      where i.id = inspection_items.inspection_id
        and lt.user_id = auth.uid()
    )
  );

-- Tenant can sign (update only tenant_signed_at / tenant_signed_by).
create policy "tenant_sign_inspection" on public.inspections
  for update
  using (
    lease_id is not null and exists (
      select 1 from public.lease_tenants lt
      where lt.lease_id = inspections.lease_id
        and lt.user_id = auth.uid()
    )
  )
  with check (
    lease_id is not null and exists (
      select 1 from public.lease_tenants lt
      where lt.lease_id = inspections.lease_id
        and lt.user_id = auth.uid()
    )
  );

create trigger inspections_set_updated_at
  before update on public.inspections
  for each row execute function public.set_updated_at();
