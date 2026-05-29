create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  amount_cents bigint not null,
  category text not null,
  vendor text,
  notes text,
  tax_deductible boolean not null default true,
  frequency text not null check (frequency in ('monthly', 'quarterly', 'annually')),
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  next_due_date date not null,
  active boolean not null default true,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recurring_expenses enable row level security;

create policy "landlord_recurring_expenses" on public.recurring_expenses
  for all using (
    property_id in (
      select id from public.properties where owner_id = auth.uid()
    )
  ) with check (
    property_id in (
      select id from public.properties where owner_id = auth.uid()
    )
  );

create index recurring_expenses_property_idx on public.recurring_expenses(property_id);
create index recurring_expenses_next_due_idx on public.recurring_expenses(next_due_date) where active = true;
