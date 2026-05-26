-- Remove duplicate (lease_id, email) rows, keeping the most recent one,
-- so the unique constraint below can be applied cleanly.
delete from public.tenant_invitations
where id not in (
  select distinct on (lease_id, email) id
  from public.tenant_invitations
  order by lease_id, email, invited_at desc
);

-- Add the unique constraint required by the upsert in /api/invitations.
alter table public.tenant_invitations
  add constraint tenant_invitations_lease_email_key unique (lease_id, email);
