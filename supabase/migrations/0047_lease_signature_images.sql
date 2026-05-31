alter table public.leases
  add column if not exists landlord_signature_image text,
  add column if not exists tenant_signature_image text;
