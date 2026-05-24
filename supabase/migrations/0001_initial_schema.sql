-- Rentalmap initial schema
-- All money is stored in cents (bigint) to avoid float rounding.
-- All dates are DATE; all timestamps are TIMESTAMPTZ.

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type user_role as enum ('landlord', 'tenant');
create type lease_status as enum ('active', 'ended', 'pending');
create type payment_method as enum ('ach', 'card', 'zelle', 'venmo', 'check', 'cash', 'other');
create type payment_status as enum ('pending', 'settled', 'failed', 'manual');
create type work_order_status as enum ('open', 'in_progress', 'closed');
create type work_order_urgency as enum ('emergency', 'urgent', 'normal', 'low');
create type contact_preference as enum ('phone', 'text', 'email');
create type invitation_status as enum ('pending', 'accepted', 'expired');
create type utility_payer as enum ('tenant', 'landlord', 'shared');

-- ---------- users (mirrors auth.users) ----------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  phone text,
  role user_role not null default 'tenant',
  emergency_contact text,
  employer text,
  vehicle_info text,
  notification_prefs jsonb not null default '{"email": true, "push": true}'::jsonb,
  stripe_customer_id text,
  stripe_connect_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_role_idx on public.users(role);

-- ---------- properties ----------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  address text not null,
  type text not null default 'single_family',
  purchase_price_cents bigint,
  placed_in_service date,
  depreciable_basis_cents bigint,
  annual_depreciation_cents bigint,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_owner_idx on public.properties(owner_id);

-- ---------- leases ----------
create table public.leases (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  monthly_rent_cents bigint not null,
  due_day smallint not null default 1 check (due_day between 1 and 28),
  late_after_day smallint not null default 5 check (late_after_day between 1 and 28),
  late_fee_cents bigint not null default 5000,
  security_deposit_cents bigint not null default 0,
  pets_allowed boolean not null default false,
  utilities_paid_by utility_payer not null default 'tenant',
  lawn_care_by utility_payer not null default 'tenant',
  terms_notes text,
  status lease_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leases_property_idx on public.leases(property_id);
create index leases_status_idx on public.leases(status);

-- ---------- lease_tenants (junction) ----------
create table public.lease_tenants (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (lease_id, user_id)
);

create index lease_tenants_lease_idx on public.lease_tenants(lease_id);
create index lease_tenants_user_idx on public.lease_tenants(user_id);

-- ---------- rent_payments ----------
create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  expected_date date not null,
  received_date date,
  amount_cents bigint not null,
  method payment_method,
  stripe_payment_intent_id text unique,
  notes text,
  status payment_status not null default 'pending',
  recorded_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rent_payments_lease_idx on public.rent_payments(lease_id);
create index rent_payments_status_idx on public.rent_payments(status);
create index rent_payments_expected_idx on public.rent_payments(expected_date);

-- ---------- expenses ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  date date not null,
  amount_cents bigint not null,
  category text not null,
  vendor text,
  notes text,
  receipt_url text,
  work_order_id uuid,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_property_date_idx on public.expenses(property_id, date desc);
create index expenses_category_idx on public.expenses(category);

-- ---------- work_orders ----------
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  lease_id uuid references public.leases(id) on delete set null,
  submitted_by_user_id uuid not null references public.users(id),
  submitted_at timestamptz not null default now(),
  request_type text not null,
  description text not null,
  urgency work_order_urgency not null default 'normal',
  status work_order_status not null default 'open',
  photo_urls text[] not null default array[]::text[],
  vendor_name text,
  vendor_phone text,
  total_cost_cents bigint,
  closed_at timestamptz,
  landlord_notes_internal text,
  landlord_notes_shared text,
  tenant_contact_preference contact_preference not null default 'text',
  updated_at timestamptz not null default now()
);

create index work_orders_property_idx on public.work_orders(property_id);
create index work_orders_status_idx on public.work_orders(status);
create index work_orders_submitted_by_idx on public.work_orders(submitted_by_user_id);

-- Now that work_orders exists, add the FK from expenses.
alter table public.expenses
  add constraint expenses_work_order_fk
  foreign key (work_order_id) references public.work_orders(id) on delete set null;

-- ---------- appliances ----------
create table public.appliances (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  install_date date,
  warranty_end date,
  serial text,
  model text,
  last_service_date date,
  next_service_due date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appliances_property_idx on public.appliances(property_id);

-- ---------- documents ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  lease_id uuid references public.leases(id) on delete set null,
  type text not null,
  filename text not null,
  file_url text not null,
  date_added date not null default current_date,
  visible_to_tenant boolean not null default false,
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index documents_property_idx on public.documents(property_id);
create index documents_visible_idx on public.documents(visible_to_tenant);

-- ---------- reminders ----------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  type text not null,
  trigger_date date not null,
  recurrence text,
  message text not null,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create index reminders_user_trigger_idx on public.reminders(user_id, trigger_date);

-- ---------- tenant_invitations ----------
create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.users(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  email text not null,
  status invitation_status not null default 'pending',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  token text not null unique default encode(gen_random_bytes(24), 'hex')
);

create index tenant_invitations_email_idx on public.tenant_invitations(email);
create index tenant_invitations_status_idx on public.tenant_invitations(status);

-- ---------- updated_at trigger helper ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'users','properties','leases','rent_payments','expenses',
      'work_orders','appliances'
    ])
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ---------- auth user → public.users bridge ----------
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'tenant')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
