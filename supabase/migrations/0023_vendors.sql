-- Vendor directory for 1099-NEC tracking.
-- A vendor paid ≥$600/year for services triggers a 1099-NEC filing requirement.

create table public.vendors (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.users(id) on delete cascade,
  name       text not null,
  address    text,
  city       text,
  state      text,
  zip        text,
  ein        text,     -- Employer Identification Number (XX-XXXXXXX)
  ssn_last4  text,     -- last 4 of SSN if individual contractor
  email      text,
  phone      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vendors_owner_idx on public.vendors(owner_id);

alter table public.vendors enable row level security;

create policy "landlord_own_vendors" on public.vendors
  for all using (owner_id = auth.uid());

-- Link existing expenses to a vendor.
alter table public.expenses
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

create index expenses_vendor_idx on public.expenses(vendor_id);

create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();
