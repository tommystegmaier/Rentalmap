-- Optional label for a saved tax report when it was scoped to a single
-- property. Null means the report covers all properties (the default).
alter table public.tax_reports
  add column if not exists property_label text;
