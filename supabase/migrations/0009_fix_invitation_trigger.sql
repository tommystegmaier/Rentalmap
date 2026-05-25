-- 0009: Stop auto-accepting invitations the instant the user row is created.
--
-- The 0004 trigger called accept_pending_invitations(new.id) from the
-- on_auth_user_created trigger. For *admin-invited* users that fires when
-- Supabase creates the row in auth.users (before the user has clicked the
-- magic link), which marked the invitation 'accepted' prematurely.
--
-- Fix: keep the public.users insert in the trigger, but move acceptance back
-- to the /auth/callback route (which already calls the RPC after a successful
-- exchangeCodeForSession).

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

  -- DO NOT call accept_pending_invitations here. Acceptance happens in
  -- /auth/callback once the user actually clicks their magic link.
  return new;
end $$;

-- Reset any invitations that were incorrectly marked 'accepted' before the
-- invited user actually signed in. The signal: the user's auth row has no
-- last_sign_in_at yet.
update public.tenant_invitations ti
   set status = 'pending', accepted_at = null
  where ti.status = 'accepted'
    and exists (
      select 1 from auth.users au
       where lower(au.email) = lower(ti.email)
         and au.last_sign_in_at is null
    );
