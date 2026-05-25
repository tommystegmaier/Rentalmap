# It Rents

Private rental property management for landlords and tenants. Built with Next.js 14
(App Router), Supabase (Postgres + Auth + Storage + RLS), Tailwind, and Stripe.

## What this scaffold gives you today

- **Auth**: landlord email+password signup, tenant magic-link sign-in.
- **Two portals** with role-gated routing and bottom tab bars sized for iPhone.
- **Landlord**: dashboard, properties list/detail, manual rent payment logging,
  expenses with photo upload, work order inbox + management, Schedule E preview,
  JSON backup export, tenant invitation flow.
- **Tenant**: dashboard with next-rent-due card, work order submission with up to
  5 photos and urgency picker, payment history, lease summary, profile editor.
- **Database**: 11 tables, full RLS so tenants can only see their own data.
- **Storage**: receipts, work-order photos, documents buckets with policies.
- **PWA**: manifest + viewport so it installs to the iOS home screen.
- **Stripe**: scaffolding for Connect onboarding and webhook reconciliation.

## What still needs filling in

These were scoped intentionally for a follow-up pass — placeholders are in place:

1. **Stripe payments** (ACH via Plaid Link, card, auto-pay subscription). The
   Connect onboarding API route is wired up but the Settings page button is
   disabled until you wire `/api/stripe/connect` to a client call.
2. **Push notifications** (web Push API + VAPID).
3. **Reports**: PDF receipts, depreciation table per year, tax export zip.
4. **Reminders engine**: cron/scheduled jobs to emit reminder rows.
5. **Documents vault upload UI** (storage policies and table are ready).
6. **JSON restore + CSV import**.
7. **Dark mode toggle** (CSS variables are already in place).

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

Create a project at https://supabase.com, then in the SQL editor run, in order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_storage.sql`

Copy `.env.local.example` to `.env.local` and fill in the Supabase keys.

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000.

### 4. Sign up + seed

1. Sign up as landlord (email + password) at `/signup`.
2. Confirm your email if required.
3. Find your `auth.users` id in Supabase dashboard → Authentication → Users.
4. Open the SQL editor and run, replacing the uuid:

```sql
\set owner_id '<your-auth-user-id>'
\i supabase/seed.sql
```

(Or paste the file's body into the editor with the variable substituted in
manually.)

This creates the Holmes St property and a lease at $2,700/mo starting 2026-06-01.

### 5. Invite Matthew & Brittany Rose

From the app: **Landlord → More → Invite tenant**. Enter their email; an
invitation row is logged and Supabase mails them a magic link. When they sign
in, they'll need to be added to `lease_tenants` (currently a manual step; the
invitation accept flow will do this automatically once wired up).

### 6. Deploy to Vercel

```bash
npx vercel
```

Set the same env vars in the Vercel project. The PWA manifest is served at
`/manifest.webmanifest`; iOS Safari users can "Add to Home Screen" once the site
is HTTPS.

## Tech notes

- Money: stored as integer cents (`bigint`). Always format via `formatCents`.
- Dates: `DATE` in DB, formatted client-side via `date-fns`.
- RLS: enforced at the database level. Even if a tenant guesses another
  tenant's UUID, the policies block the read.
- Storage paths: `receipts/<property_id>/...`, `work-order-photos/<work_order_id>/...`,
  `documents/<property_id>/...`. Storage RLS policies match these conventions.

## Repo layout

```
app/
  (auth) login/, signup/, auth/callback   — auth flows
  landlord/                                 — landlord portal
  tenant/                                   — tenant portal
  api/                                      — server routes (invites, stripe, backup)
components/                                 — UI primitives, tab bar
lib/
  supabase/                                 — client + server + middleware helpers
  types/database.ts                         — DB row types
  constants.ts                              — categories, urgency labels, app name
supabase/
  migrations/                               — DDL + RLS + storage policies
  seed.sql                                  — Holmes St property + lease
```
