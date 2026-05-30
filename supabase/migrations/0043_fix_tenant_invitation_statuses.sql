-- Repair tenant invitation statuses so badge colours are correct.
--
-- Two scenarios being fixed:
--
-- 1. Tenants whose invitation was reset to 'pending' by the re-invite upsert
--    (or by migration 0009's one-time cleanup) but who have since signed in —
--    their lease_tenants row exists and last_sign_in_at is set, so they are
--    clearly active. Mark the invitation accepted.
--
-- 2. Tenants who have a lease_tenants row but no tenant_invitations record at
--    all (added outside the normal invite flow, or invitation was deleted after
--    acceptance). Insert an accepted record so the badge shows green.

-- Fix 1: pending invitations for tenants who have signed in.
update public.tenant_invitations ti
set
  status      = 'accepted',
  accepted_at = coalesce(ti.accepted_at, au.last_sign_in_at, now())
from public.lease_tenants lt
join public.users  u  on u.id  = lt.user_id
join auth.users    au on au.id = lt.user_id
where ti.lease_id           = lt.lease_id
  and lower(ti.email)       = lower(u.email)
  and ti.status             = 'pending'
  and au.last_sign_in_at is not null;

-- Fix 2: lease_tenants rows with no invitation record and tenant has signed in.
insert into public.tenant_invitations (landlord_id, lease_id, email, status, accepted_at)
select
  p.owner_id                                   as landlord_id,
  lt.lease_id,
  u.email,
  'accepted'                                   as status,
  coalesce(au.last_sign_in_at, now())          as accepted_at
from public.lease_tenants lt
join public.users    u  on u.id  = lt.user_id
join auth.users      au on au.id = lt.user_id
join public.leases   l  on l.id  = lt.lease_id
join public.properties p on p.id = l.property_id
where au.last_sign_in_at is not null
  and not exists (
    select 1
    from public.tenant_invitations ti
    where ti.lease_id     = lt.lease_id
      and lower(ti.email) = lower(u.email)
  )
on conflict (lease_id, email) do nothing;
