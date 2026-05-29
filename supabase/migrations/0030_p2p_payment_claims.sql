-- Generalize the Venmo claim system into a P2P claim system that also supports
-- Cash App and Zelle. Existing rows default to 'venmo' for backward compat.
alter table public.venmo_payment_claims
  add column if not exists method text not null default 'venmo'
    check (method in ('venmo', 'cashapp', 'zelle'));

-- Store each landlord's payment handles so tenants can deep-link / copy them.
--   venmo_handle      e.g. "john-doe" (Venmo username, no leading @)
--   cashapp_cashtag   e.g. "johndoe"  ($cashtag, no leading $)
--   zelle_handle      e.g. "john@example.com" or a phone number
alter table public.users
  add column if not exists venmo_handle text,
  add column if not exists cashapp_cashtag text,
  add column if not exists zelle_handle text;
