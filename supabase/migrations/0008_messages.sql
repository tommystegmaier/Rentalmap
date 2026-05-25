-- Direct messages between landlord and tenant.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  lease_id uuid references public.leases(id) on delete set null,
  body text not null check (length(body) > 0 and length(body) <= 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_pair_idx
  on public.messages(sender_id, recipient_id, created_at desc);
create index messages_recipient_unread_idx
  on public.messages(recipient_id) where read_at is null;

alter table public.messages enable row level security;

create policy messages_select_participants
  on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy messages_insert_self
  on public.messages for insert
  with check (sender_id = auth.uid());

create policy messages_update_recipient
  on public.messages for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
