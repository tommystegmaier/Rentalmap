-- Full security-deposit lifecycle: receipt → interest accrual → return/deductions.
create table public.security_deposits (
  id                    uuid primary key default gen_random_uuid(),
  lease_id              uuid not null unique references public.leases(id) on delete cascade,
  amount_cents          bigint not null,
  received_date         date,
  holding_institution   text,             -- bank/escrow account name
  account_last4         text,             -- last 4 of account for reference
  interest_rate_pct     numeric(6,4) not null default 0,  -- annual %, e.g. 5.0000 = 5%
  interest_accrued_cents bigint not null default 0,
  last_interest_calc    date,
  status                text not null default 'holding'
    check (status in ('holding', 'returned', 'partially_returned', 'applied_to_damages', 'forfeited')),
  returned_date         date,
  returned_amount_cents bigint,
  deduction_items       jsonb,            -- [{label, amount_cents}]
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index security_deposits_lease_idx on public.security_deposits(lease_id);

alter table public.security_deposits enable row level security;

create policy "landlord_security_deposits" on public.security_deposits
  for all
  using (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = security_deposits.lease_id
        and p.owner_id = auth.uid()
    )
  );

create policy "tenant_read_security_deposits" on public.security_deposits
  for select
  using (
    exists (
      select 1 from public.lease_tenants lt
      where lt.lease_id = security_deposits.lease_id
        and lt.user_id = auth.uid()
    )
  );

create trigger security_deposits_set_updated_at
  before update on public.security_deposits
  for each row execute function public.set_updated_at();
