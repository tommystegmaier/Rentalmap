-- Storage bucket for inspection item photos.
insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do nothing;

-- Authenticated users can upload inspection photos.
create policy "inspection photos write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'inspection-photos');

-- Authenticated users can read (needed for createSignedUrls on the detail page).
create policy "inspection photos read"
  on storage.objects for select to authenticated
  using (bucket_id = 'inspection-photos');

-- Authenticated users can delete.
create policy "inspection photos delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'inspection-photos');
