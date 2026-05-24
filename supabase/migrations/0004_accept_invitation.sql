-- When a new auth user is created OR signs in, look for any pending invitation
-- matching their email and auto-link them to the lease.
create or replace function public.accept_pending_invitations(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_inv record;
begin
  select email into v_email from public.users where id = uid;
  if v_email is null then return; end if;

  for v_inv in
    select id, lease_id from public.tenant_invitations
     where lower(email) = lower(v_email) and status = 'pending'
  loop
    -- Promote to tenant role if they aren't already a landlord.
    update public.users
       set role = 'tenant'
     where id = uid and role <> 'landlord';

    -- Link them to the lease (idempotent).
    insert into public.lease_tenants (lease_id, user_id)
    values (v_inv.lease_id, uid)
    on conflict (lease_id, user_id) do nothing;

    -- Mark the invitation accepted.
    update public.tenant_invitations
       set status = 'accepted', accepted_at = now()
     where id = v_inv.id;
  end loop;
end $$;

-- Run when a brand new auth user is created (mirrors the existing on_auth_user_created flow).
create or replace function public.handle_new_auth_user_with_invites()
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

  perform public.accept_pending_invitations(new.id);
  return new;
end $$;

-- Replace the trigger from 0001 with the invite-aware version.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_with_invites();
