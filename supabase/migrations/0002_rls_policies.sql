-- Row-Level Security: landlords see what they own; tenants see only their own lease data.

alter table public.users enable row level security;
alter table public.properties enable row level security;
alter table public.leases enable row level security;
alter table public.lease_tenants enable row level security;
alter table public.rent_payments enable row level security;
alter table public.expenses enable row level security;
alter table public.work_orders enable row level security;
alter table public.appliances enable row level security;
alter table public.documents enable row level security;
alter table public.reminders enable row level security;
alter table public.tenant_invitations enable row level security;

-- ---------- helper: is_landlord ----------
create or replace function public.is_landlord(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = uid and role = 'landlord');
$$;

-- ---------- helper: tenant_lease_ids ----------
create or replace function public.tenant_lease_ids(uid uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select lease_id from public.lease_tenants where user_id = uid;
$$;

-- ---------- helper: tenant_property_ids ----------
create or replace function public.tenant_property_ids(uid uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select l.property_id
  from public.leases l
  join public.lease_tenants lt on lt.lease_id = l.id
  where lt.user_id = uid;
$$;

-- ---------- users ----------
-- Every authenticated user can read their own row.
create policy users_self_select on public.users
  for select using (auth.uid() = id);

-- Landlords can read tenant rows for their leases.
create policy users_landlord_select_tenants on public.users
  for select using (
    public.is_landlord(auth.uid())
    and exists (
      select 1
      from public.lease_tenants lt
      join public.leases l on l.id = lt.lease_id
      join public.properties p on p.id = l.property_id
      where lt.user_id = users.id and p.owner_id = auth.uid()
    )
  );

-- Users can update their own profile.
create policy users_self_update on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- properties ----------
create policy properties_landlord_all on public.properties
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Tenants can read properties tied to their lease.
create policy properties_tenant_select on public.properties
  for select using (id in (select public.tenant_property_ids(auth.uid())));

-- ---------- leases ----------
create policy leases_landlord_all on public.leases
  for all using (
    exists (select 1 from public.properties p where p.id = leases.property_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.properties p where p.id = leases.property_id and p.owner_id = auth.uid())
  );

create policy leases_tenant_select on public.leases
  for select using (id in (select public.tenant_lease_ids(auth.uid())));

-- ---------- lease_tenants ----------
create policy lease_tenants_landlord_all on public.lease_tenants
  for all using (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = lease_tenants.lease_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = lease_tenants.lease_id and p.owner_id = auth.uid()
    )
  );

create policy lease_tenants_self_select on public.lease_tenants
  for select using (user_id = auth.uid());

-- ---------- rent_payments ----------
create policy rent_payments_landlord_all on public.rent_payments
  for all using (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = rent_payments.lease_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.leases l
      join public.properties p on p.id = l.property_id
      where l.id = rent_payments.lease_id and p.owner_id = auth.uid()
    )
  );

create policy rent_payments_tenant_select on public.rent_payments
  for select using (lease_id in (select public.tenant_lease_ids(auth.uid())));

-- ---------- expenses (landlord only) ----------
create policy expenses_landlord_all on public.expenses
  for all using (
    exists (select 1 from public.properties p where p.id = expenses.property_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.properties p where p.id = expenses.property_id and p.owner_id = auth.uid())
  );

-- ---------- work_orders ----------
create policy work_orders_landlord_all on public.work_orders
  for all using (
    exists (select 1 from public.properties p where p.id = work_orders.property_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.properties p where p.id = work_orders.property_id and p.owner_id = auth.uid())
  );

-- Tenants can read and create work orders on their lease/property.
create policy work_orders_tenant_select on public.work_orders
  for select using (
    submitted_by_user_id = auth.uid()
    or lease_id in (select public.tenant_lease_ids(auth.uid()))
  );

create policy work_orders_tenant_insert on public.work_orders
  for insert with check (
    submitted_by_user_id = auth.uid()
    and lease_id in (select public.tenant_lease_ids(auth.uid()))
  );

-- ---------- appliances (landlord only) ----------
create policy appliances_landlord_all on public.appliances
  for all using (
    exists (select 1 from public.properties p where p.id = appliances.property_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.properties p where p.id = appliances.property_id and p.owner_id = auth.uid())
  );

-- ---------- documents ----------
create policy documents_landlord_all on public.documents
  for all using (
    exists (select 1 from public.properties p where p.id = documents.property_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.properties p where p.id = documents.property_id and p.owner_id = auth.uid())
  );

-- Tenants see documents flagged visible_to_tenant on their property.
create policy documents_tenant_select on public.documents
  for select using (
    visible_to_tenant
    and property_id in (select public.tenant_property_ids(auth.uid()))
  );

-- ---------- reminders ----------
create policy reminders_self_all on public.reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- tenant_invitations ----------
create policy tenant_invitations_landlord_all on public.tenant_invitations
  for all using (landlord_id = auth.uid()) with check (landlord_id = auth.uid());

-- Invitee can look up their own invitation by email.
create policy tenant_invitations_invitee_select on public.tenant_invitations
  for select using (
    lower(email) = lower((select email from public.users where id = auth.uid()))
  );
