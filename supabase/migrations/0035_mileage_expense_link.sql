-- Link each mileage trip to the expense record it creates on save.
-- ON DELETE SET NULL so deleting the expense directly orphans the trip
-- rather than cascading in the unexpected direction; trip deletion handles
-- the expense side explicitly in the server action.
alter table public.mileage_trips
  add column if not exists expense_id uuid references public.expenses(id) on delete set null;
