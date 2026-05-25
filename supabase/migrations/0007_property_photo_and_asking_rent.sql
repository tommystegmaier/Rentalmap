-- Property photo + asking rent

alter table public.properties
  add column if not exists photo_url text,
  add column if not exists asking_rent_cents bigint;

-- New storage bucket for property cover photos.
-- Public read keeps display simple; paths include the property's uuid so URLs
-- aren't enumerable. Writes are still RLS-restricted to the property's owner.
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', true)
on conflict (id) do nothing;

create policy "property photos owner write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-photos'
    and exists (
      select 1 from public.properties p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );

create policy "property photos owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-photos'
    and exists (
      select 1 from public.properties p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );

create policy "property photos owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-photos'
    and exists (
      select 1 from public.properties p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );
