-- Photos of the completed repair, added by the landlord (separate from the
-- tenant's photos in photo_urls). Stored in the work-order-photos bucket.
alter table public.work_orders
  add column if not exists repair_photo_urls text[] not null default array[]::text[];
