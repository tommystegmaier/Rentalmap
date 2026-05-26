-- Tracks tenant-submitted "I sent a Venmo" claims that landlords approve or deny.
-- Approval auto-creates a rent_payment record.

create table public.venmo_payment_claims (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  tenant_user_id uuid not null references public.users(id),
  amount_cents bigint not null,
  expected_date date not null,
  venmo_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id),
  denial_reason text
);

create index venmo_claims_lease_idx on public.venmo_payment_claims(lease_id);
create index venmo_claims_tenant_idx on public.venmo_payment_claims(tenant_user_id);
create index venmo_claims_status_idx on public.venmo_payment_claims(status);

alter table public.venmo_payment_claims enable row level security;

-- Tenants: read and insert their own claims
create policy "tenant_own_venmo_claims" on public.venmo_payment_claims
  for all
  using (tenant_user_id = auth.uid())
  with check (tenant_user_id = auth.uid());

-- Landlords: read and update claims for their properties
create policy "landlord_property_venmo_claims" on public.venmo_payment_claims
  for all
  using (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = venmo_payment_claims.lease_id
        and p.owner_id = auth.uid()
    )
  );
