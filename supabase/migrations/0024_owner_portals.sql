-- Owner portals: a property manager (landlord) manages properties on behalf of
-- investors (owners) who get a read-only financial dashboard.

-- Add 'owner' to the role enum.
alter type user_role add value if not exists 'owner';

-- Junction: which users own (or co-own) which properties.
create table public.property_owners (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties(id) on delete cascade,
  owner_user_id      uuid not null references public.users(id) on delete cascade,
  ownership_pct      numeric(5,2) not null default 100.00
    check (ownership_pct > 0 and ownership_pct <= 100),
  added_at           timestamptz not null default now(),
  unique (property_id, owner_user_id)
);

create index property_owners_property_idx on public.property_owners(property_id);
create index property_owners_owner_idx    on public.property_owners(owner_user_id);

alter table public.property_owners enable row level security;

-- The managing landlord can CRUD ownership links for their properties.
create policy "manager_property_owners" on public.property_owners
  for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_owners.property_id
        and p.owner_id = auth.uid()
    )
  );

-- The owner can read their own links.
create policy "owner_read_own_links" on public.property_owners
  for select
  using (owner_user_id = auth.uid());

-- Invitations for property managers to onboard investors.
create table public.owner_invitations (
  id           uuid primary key default gen_random_uuid(),
  manager_id   uuid not null references public.users(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  email        text not null,
  ownership_pct numeric(5,2) not null default 100.00,
  status       text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired')),
  token        text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_at   timestamptz not null default now(),
  accepted_at  timestamptz
);

create index owner_invitations_token_idx  on public.owner_invitations(token);
create index owner_invitations_email_idx  on public.owner_invitations(email);
create index owner_invitations_manager_idx on public.owner_invitations(manager_id);

alter table public.owner_invitations enable row level security;

create policy "manager_owner_invitations" on public.owner_invitations
  for all using (manager_id = auth.uid());

-- Owners can see their own invitations.
create policy "owner_read_invitations" on public.owner_invitations
  for select using (
    email = (select email from public.users where id = auth.uid())
  );
