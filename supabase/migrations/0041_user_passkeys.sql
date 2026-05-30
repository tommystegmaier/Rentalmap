-- Passkeys (WebAuthn credentials) for Face ID / Touch ID / platform biometric login.
create table public.user_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,            -- base64url-encoded COSE public key
  counter bigint not null default 0,
  transports text,                     -- comma-separated AuthenticatorTransport list
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index user_passkeys_user_idx on public.user_passkeys(user_id);

alter table public.user_passkeys enable row level security;

-- Users manage only their own passkeys. The login (authenticate) flow runs
-- before a session exists, so those routes use the service-role client.
create policy "own_passkeys" on public.user_passkeys
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
