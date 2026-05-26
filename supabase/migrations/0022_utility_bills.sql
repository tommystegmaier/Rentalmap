-- Per-property utility bill tracking with optional link to expense record.

create table public.utility_bills (
  id                   uuid primary key default gen_random_uuid(),
  property_id          uuid not null references public.properties(id) on delete cascade,
  utility_type         text not null
    check (utility_type in ('electric','gas','water','sewer','trash','internet','cable','other')),
  provider_name        text,
  account_number       text,
  billing_period_start date,
  billing_period_end   date,
  amount_cents         bigint not null,
  paid_by              text not null default 'landlord'
    check (paid_by in ('landlord','tenant','shared')),
  due_date             date,
  paid_date            date,
  notes                text,
  expense_id           uuid references public.expenses(id) on delete set null,
  created_by           uuid not null references public.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index utility_bills_property_idx on public.utility_bills(property_id);
create index utility_bills_type_idx    on public.utility_bills(utility_type);
create index utility_bills_period_idx  on public.utility_bills(billing_period_start desc);

alter table public.utility_bills enable row level security;

create policy "landlord_utility_bills" on public.utility_bills
  for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = utility_bills.property_id
        and p.owner_id = auth.uid()
    )
  );

-- Tenants whose lease covers this property can read bills paid by tenant/shared.
create policy "tenant_read_utility_bills" on public.utility_bills
  for select
  using (
    paid_by in ('tenant','shared') and exists (
      select 1 from public.leases l
      join public.lease_tenants lt on lt.lease_id = l.id
      where l.property_id = utility_bills.property_id
        and lt.user_id = auth.uid()
        and l.status = 'active'
    )
  );

create trigger utility_bills_set_updated_at
  before update on public.utility_bills
  for each row execute function public.set_updated_at();
