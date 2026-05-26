-- One-time backfill: create public.users rows for any auth.users that are
-- missing one. This handles tenants who were invited before the user-creation
-- trigger was installed (or when the trigger silently failed). Without this
-- row, accept_pending_invitations early-returns and /welcome shows
-- "Link expired" even though the session is valid.
insert into public.users (id, email, name, role)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  coalesce((au.raw_user_meta_data->>'role')::user_role, 'tenant')
from auth.users au
where au.email is not null
  and not exists (select 1 from public.users u where u.id = au.id)
on conflict (id) do nothing;

-- Self-heal version of accept_pending_invitations: if the public.users row
-- is missing (because the trigger didn't fire, or fired against an older
-- schema), backfill it from auth.users before processing invitations.
create or replace function public.accept_pending_invitations(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_inv record;
begin
  -- Backfill missing public.users row from auth.users.
  insert into public.users (id, email, name, role)
  select
    au.id,
    au.email,
    coalesce(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    coalesce((au.raw_user_meta_data->>'role')::user_role, 'tenant')
  from auth.users au
  where au.id = uid
    and au.email is not null
  on conflict (id) do nothing;

  select email into v_email from public.users where id = uid;
  if v_email is null then return; end if;

  for v_inv in
    select id, lease_id from public.tenant_invitations
     where lower(email) = lower(v_email) and status = 'pending'
  loop
    update public.users
       set role = 'tenant'
     where id = uid and role <> 'landlord';

    insert into public.lease_tenants (lease_id, user_id)
    values (v_inv.lease_id, uid)
    on conflict (lease_id, user_id) do nothing;

    update public.tenant_invitations
       set status = 'accepted', accepted_at = now()
     where id = v_inv.id;
  end loop;
end $$;
