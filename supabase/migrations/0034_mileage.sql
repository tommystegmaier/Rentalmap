-- Mileage tracking. Landlords log deductible trips (inspections, repairs,
-- showings, supply runs) per property. The deduction uses the IRS standard
-- mileage rate, stored per-trip so historical rates survive future changes.
-- Mileage folds into the tax report's "Auto and Travel" Schedule E category.
create table if not exists public.mileage_trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  trip_date date not null,
  miles numeric(8, 1) not null check (miles > 0),
  rate_cents numeric(6, 2) not null check (rate_cents > 0), -- cents per mile, e.g. 70.00
  purpose text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists mileage_trips_owner_idx
  on public.mileage_trips(owner_id, trip_date desc);

create index if not exists mileage_trips_property_idx
  on public.mileage_trips(property_id);

alter table public.mileage_trips enable row level security;

create policy mileage_trips_owner_all on public.mileage_trips
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
