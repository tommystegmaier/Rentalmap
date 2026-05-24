-- Storage buckets. Run after enabling storage in Supabase.
insert into storage.buckets (id, name, public)
values
  ('receipts', 'receipts', false),
  ('work-order-photos', 'work-order-photos', false),
  ('documents', 'documents', false)
on conflict (id) do nothing;

-- Path convention: <property_id>/<filename> for receipts and documents.
-- Path convention: <work_order_id>/<filename> for work-order-photos.

-- Receipts: only the property owner can read/write.
create policy "receipts landlord read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.properties p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );

create policy "receipts landlord write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.properties p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );

create policy "receipts landlord delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.properties p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );

-- Work order photos: tenant who submitted + landlord can read; tenant can write to their lease's work orders.
create policy "work order photos read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'work-order-photos'
    and exists (
      select 1 from public.work_orders w
      join public.properties p on p.id = w.property_id
      where w.id::text = split_part(name, '/', 1)
        and (p.owner_id = auth.uid() or w.submitted_by_user_id = auth.uid())
    )
  );

create policy "work order photos write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'work-order-photos');

-- Documents: landlord read/write; tenants read only if document is visible_to_tenant.
create policy "documents landlord all"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.properties p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from public.properties p
      where p.id::text = split_part(name, '/', 1)
        and p.owner_id = auth.uid()
    )
  );

create policy "documents tenant read visible"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.file_url like '%' || storage.objects.name
        and d.visible_to_tenant
        and d.property_id in (select public.tenant_property_ids(auth.uid()))
    )
  );
