-- Receipt attached to a work order by the landlord (storage path in the
-- existing `receipts` bucket, keyed by property_id like other receipts).
alter table public.work_orders
  add column if not exists receipt_url text;

-- The expense auto-created when a work order with a receipt is completed.
-- Tracked so we never create a duplicate expense on re-save / reopen.
alter table public.work_orders
  add column if not exists expense_id uuid references public.expenses(id) on delete set null;
