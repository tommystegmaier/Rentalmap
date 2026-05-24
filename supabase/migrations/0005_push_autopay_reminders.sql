-- Push subscriptions (web push), auto-pay setups, and a small reminders index.

-- ---------- push_subscriptions ----------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_self
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- autopay_subscriptions ----------
create table public.autopay_subscriptions (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  tenant_user_id uuid not null references public.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_payment_method_id text,
  status text not null default 'active',
  pay_day smallint not null default 1 check (pay_day between 1 and 28),
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, tenant_user_id)
);

create index autopay_lease_idx on public.autopay_subscriptions(lease_id);
create index autopay_tenant_idx on public.autopay_subscriptions(tenant_user_id);

create trigger autopay_subscriptions_set_updated_at
  before update on public.autopay_subscriptions
  for each row execute function public.set_updated_at();

alter table public.autopay_subscriptions enable row level security;

create policy autopay_landlord_all
  on public.autopay_subscriptions for all
  using (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = autopay_subscriptions.lease_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = autopay_subscriptions.lease_id and p.owner_id = auth.uid()
    )
  );

create policy autopay_tenant_select
  on public.autopay_subscriptions for select
  using (tenant_user_id = auth.uid());

-- Stripe price ids cached per lease so we don't re-create a Stripe Price every month.
create table public.lease_stripe_prices (
  lease_id uuid primary key references public.leases(id) on delete cascade,
  stripe_price_id text not null,
  amount_cents bigint not null,
  created_at timestamptz not null default now()
);

alter table public.lease_stripe_prices enable row level security;

create policy lease_stripe_prices_owner
  on public.lease_stripe_prices for all
  using (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = lease_stripe_prices.lease_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = lease_stripe_prices.lease_id and p.owner_id = auth.uid()
    )
  );

-- ---------- reminders: speed up the cron lookup ----------
create index if not exists reminders_trigger_dismissed_idx
  on public.reminders(trigger_date, dismissed);
