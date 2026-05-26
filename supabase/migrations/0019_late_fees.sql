-- Per-lease toggle for automated late-fee charging.
alter table public.leases
  add column if not exists late_fee_enabled boolean not null default false;

-- Individual late-fee charge records (separate from rent payments so they can be waived).
create table public.late_fee_charges (
  id          uuid primary key default gen_random_uuid(),
  lease_id    uuid not null references public.leases(id) on delete cascade,
  charge_date date not null,
  amount_cents bigint not null,
  period_start date not null,  -- month the late fee applies to
  reason      text not null default 'Rent not received by grace period',
  waived      boolean not null default false,
  waived_by   uuid references public.users(id),
  waived_at   timestamptz,
  waive_note  text,
  created_at  timestamptz not null default now()
);

create index late_fee_charges_lease_idx on public.late_fee_charges(lease_id);
create index late_fee_charges_period_idx on public.late_fee_charges(period_start);

alter table public.late_fee_charges enable row level security;

-- Landlord: full access to charges on their properties.
create policy "landlord_late_fee_charges" on public.late_fee_charges
  for all
  using (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = late_fee_charges.lease_id
        and p.owner_id = auth.uid()
    )
  );

-- Tenant: read their own.
create policy "tenant_read_late_fee_charges" on public.late_fee_charges
  for select
  using (
    exists (
      select 1 from public.lease_tenants lt
      where lt.lease_id = late_fee_charges.lease_id
        and lt.user_id = auth.uid()
    )
  );
