-- Tax deductibility flag on expenses. Defaults to true (most operating
-- expenses are deductible); mortgage principal and similar are marked false.
alter table public.expenses
  add column if not exists tax_deductible boolean not null default true;

-- Scheduled tax-report settings per landlord.
alter table public.users
  add column if not exists tax_report_enabled boolean not null default false,
  add column if not exists tax_report_month int,
  add column if not exists tax_report_day int,
  add column if not exists tax_report_last_run timestamptz;

-- Generated tax reports (the single combined PDF), portfolio-wide per year.
create table if not exists public.tax_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  year int not null,
  file_path text not null,
  total_income_cents bigint not null default 0,
  total_deductible_cents bigint not null default 0,
  total_nondeductible_cents bigint not null default 0,
  net_cents bigint not null default 0,
  generated_at timestamptz not null default now(),
  generated_by text not null default 'manual'
);

create index if not exists tax_reports_owner_idx on public.tax_reports(owner_id, year desc);

alter table public.tax_reports enable row level security;

create policy tax_reports_owner_all on public.tax_reports
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Private bucket for the generated tax-report PDFs. Read/write happens through
-- the service role (cron + download route), so no per-user storage policy.
insert into storage.buckets (id, name, public)
values ('tax-reports', 'tax-reports', false)
on conflict (id) do nothing;
