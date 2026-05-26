-- Lease documents (and lease addenda) should always be visible to tenants on
-- the property, regardless of upload order or the visible_to_tenant flag. A
-- lease is by definition a contract between the landlord and the tenant, so
-- hiding it makes no sense — and confused at least one landlord who uploaded
-- the lease before linking the tenant to the property.

-- 1. Backfill any existing lease/addendum docs that weren't flagged visible.
update public.documents
set visible_to_tenant = true
where type in ('Lease', 'Lease addendum')
  and visible_to_tenant = false;

-- 2. Update the tenant select RLS policy so lease/addendum docs are always
-- visible to tenants on the property, regardless of the flag. Other document
-- types (inspections, receipts, tax docs) still respect visible_to_tenant so
-- landlords can keep private notes hidden.
drop policy if exists documents_tenant_select on public.documents;
create policy documents_tenant_select on public.documents
  for select using (
    property_id in (select public.tenant_property_ids(auth.uid()))
    and (
      visible_to_tenant
      or type in ('Lease', 'Lease addendum')
    )
  );
