-- When a new tenant accepts an invitation, clear the previous tenant's
-- signature so the incoming tenant must sign the lease fresh.
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

    -- Clear the previous tenant's signature so this new tenant must sign fresh.
    update public.leases
       set tenant_signed_at = null, tenant_signed_name = null
     where id = v_inv.lease_id;
  end loop;
end $$;
