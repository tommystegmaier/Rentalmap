alter table public.leases
  add column if not exists landlord_signed_at timestamptz,
  add column if not exists landlord_signed_name text,
  add column if not exists tenant_signed_at timestamptz,
  add column if not exists tenant_signed_name text,
  add column if not exists signed_lease_path text;
