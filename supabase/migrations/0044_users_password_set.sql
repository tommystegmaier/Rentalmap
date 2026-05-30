-- Track whether the user has explicitly set a password on /welcome.
-- This is the signal the landlord UI uses to show a green "active" badge.
alter table public.users
  add column if not exists password_set boolean not null default false;

-- Backfill for anyone who already went through /welcome and set a password.
-- The welcome page stores password_set=true in auth.users.raw_user_meta_data.
update public.users u
set password_set = true
from auth.users au
where au.id = u.id
  and (au.raw_user_meta_data->>'password_set')::boolean = true;
