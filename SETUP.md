# Get Rentalmap live on your iPhone — step by step

Written for someone with **no coding experience**. Reading time: ~10 minutes.
Total setup time: about **45 minutes** the first time. After that, your tenants can
install the app in under a minute each.

You'll do five things, in order:

1. Set up a free **database** (Supabase) — where your property/lease/tenant data lives
2. Set up a free **payment processor** (Stripe) — so tenants can pay rent in-app
3. **Publish the app to the internet** (Vercel) — gives you a public URL like `rentalmap.vercel.app`
4. **Sign up + load your property data** — your landlord account, the Holmes St property, the Rose lease
5. **Install on iPhone** — yours, then send the link to Matthew and Brittany

> A note before you start: everything below uses **free tiers**. Supabase free plan
> handles up to 500 MB of data (you'll use a tiny fraction). Vercel's free plan
> handles personal projects fine. Stripe is free to sign up; you only pay a small
> percentage of each transaction. Total monthly cost if your tenants pay through
> the app: roughly **$1–$5 in Stripe fees per rent payment**, nothing else.

---

## Part 1 — Set up the database (Supabase) · ~10 min

Supabase is a free service that stores your property data and handles tenant sign-in.
Think of it as a private spreadsheet on the internet with strict permission rules.

### 1.1 Create your account

1. Open a browser and go to **https://supabase.com**.
2. Click **Start your project** (top right).
3. Sign in with GitHub (recommended — you'll use GitHub for Vercel too) or with email.

### 1.2 Create a new project

1. Click **New project**.
2. **Organization**: pick your personal org (it's created automatically).
3. **Project name**: type `Rentalmap`.
4. **Database password**: click **Generate a password**, then **copy it somewhere
   safe** (a password manager, or write it down). You probably won't need it
   again, but you can't recover it.
5. **Region**: pick the one closest to Omaha — **East US (North Virginia)** is a
   good default.
6. **Pricing plan**: Free.
7. Click **Create new project**. Supabase will provision the database — takes about 2 minutes.

### 1.3 Copy your project keys

While provisioning, you'll land on the project home page. We need three pieces of
information from here:

1. In the left sidebar click the **gear icon (Project Settings)** → **API**.
2. You'll see a section called **Project URL** and another called **Project API keys**.
3. **Open a plain text file** (Notes app, TextEdit, anywhere you can paste) and
   copy these three values, labeled like this:

   ```
   NEXT_PUBLIC_SUPABASE_URL = (the URL — looks like https://abcdefg.supabase.co)
   NEXT_PUBLIC_SUPABASE_ANON_KEY = (the long key labeled "anon" / "public")
   SUPABASE_SERVICE_ROLE_KEY = (the long key labeled "service_role" — keep this secret!)
   ```

   You'll paste these into Vercel in Part 3.

> **Important**: the `service_role` key is like a master key. Never put it in a
> screenshot, email, or text message. We'll only paste it into Vercel.

### 1.4 Load the database structure

This step creates the tables (properties, leases, tenants, etc.) inside your fresh
database.

1. In the left sidebar click the **SQL Editor** icon (looks like a database
   symbol with `>_`).
2. Click **New query**.
3. **Open** `supabase/migrations/0001_initial_schema.sql` from this repo in
   GitHub (or any text editor) and **copy its entire contents**.
4. **Paste** into the SQL Editor and click **Run** (bottom right, or press
   Cmd/Ctrl + Return). You'll see "Success. No rows returned" — that's good.
5. Click **New query** again. Repeat with `supabase/migrations/0002_rls_policies.sql`.
6. Click **New query** again. Repeat with `supabase/migrations/0003_storage.sql`.
7. Click **New query** again. Repeat with `supabase/migrations/0004_accept_invitation.sql`.
8. Click **New query** again. Repeat with `supabase/migrations/0005_push_autopay_reminders.sql`.
9. Click **New query** again. Repeat with `supabase/migrations/0006_tenant_rent_reminders.sql`.
10. Click **New query** again. Repeat with `supabase/migrations/0007_property_photo_and_asking_rent.sql`.
11. Click **New query** again. Repeat with `supabase/migrations/0008_messages.sql`.
12. Click **New query** again. Repeat with `supabase/migrations/0009_fix_invitation_trigger.sql`.
13. Click **New query** again. Repeat with `supabase/migrations/0010_appliance_service_intervals.sql`.
14. Click **New query** one more time. Repeat with `supabase/migrations/0011_appliance_types.sql`.

You should now have 15 tables. To check: in the left sidebar click the **Table
Editor** icon. You'll see `appliances`, `autopay_subscriptions`, `documents`,
`expenses`, `lease_stripe_prices`, `lease_tenants`, `leases`, `messages`,
`properties`, `push_subscriptions`, `reminders`, `rent_payments`,
`tenant_invitations`, `users`, and `work_orders` — all empty for now.

Done with Supabase. Leave the tab open; you'll come back to it later for one more
step.

---

## Part 2 — Set up payments (Stripe) · ~10 min

Stripe is the payment processor. You'll be using **Stripe Connect** — the same
infrastructure Lyft, Shopify, and Substack use. Money goes from tenant → Stripe →
straight to your bank, never through Rentalmap.

### 2.1 Create your Stripe account

1. Go to **https://stripe.com** and click **Start now**.
2. Sign up with your email.
3. Verify your email when Stripe sends you a confirmation.

### 2.2 Activate your account

To accept real payments (not just test ones), Stripe needs to verify you.

1. From the Stripe dashboard, click **Activate payments** (or it might say
   **Complete your account**).
2. Fill in:
   - Business type: **Individual / sole proprietor**
   - Legal name, address, SSN (last 4 digits to start, full SSN may be required)
   - Bank account info (routing + account number) — this is where rent will deposit
3. Submit. Stripe may instantly approve or take a day or two for review.

> You can finish the rest of the setup in **test mode** while Stripe reviews your
> account. Just know that until Stripe activates you, the Pay Rent button will only
> work with Stripe's test card numbers, not real money.

### 2.3 Copy your API keys

1. In the Stripe dashboard, click **Developers** (top right) → **API keys**.
2. You'll see two keys: **Publishable key** (starts with `pk_`) and **Secret key**
   (starts with `sk_`, hidden — click "Reveal").
3. Add to your notes file:

   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = (the pk_ value)
   STRIPE_SECRET_KEY = (the sk_ value)
   ```

> Make sure you're in **Live mode** (toggle in the top right of the Stripe
> dashboard) before copying live keys. If you only see test keys (starting with
> `pk_test_` and `sk_test_`), that's fine for now — use those, and switch later
> once Stripe activates you.

### 2.4 Hold off on the webhook for now

There's one more Stripe step — registering a webhook — but it requires your live
URL, which you'll get in Part 3. We'll come back here.

---

## Part 3 — Publish the app to the internet (Vercel) · ~10 min

Vercel hosts the app and gives you a public URL. It's free for personal projects
and built by the same people who made the framework Rentalmap runs on, so it's
basically zero-config.

### 3.1 Connect Vercel to GitHub

1. Go to **https://vercel.com** and click **Sign up**.
2. Sign up with **GitHub** (this is important — Vercel needs to read your repo).
3. Vercel will ask permission to access your GitHub repos — say yes.

### 3.2 Import the Rentalmap repo

1. On the Vercel dashboard, click **Add New… → Project**.
2. You'll see a list of your GitHub repos. Find **Rentalmap** and click **Import**.
3. **Project Name**: leave it as `rentalmap`.
4. **Framework Preset**: Vercel will auto-detect "Next.js" — leave it.
5. **Root Directory**: leave it as `./`.

### 3.3 Add environment variables

This is where you paste all those keys from Parts 1 and 2.

> **Vercel quirk**: the "Add" form won't accept empty values. For any row marked
> "skip for now" below, **don't add the row at all** during this first deploy.
> You'll add them later via Settings → Environment Variables once you have the
> real value.

Scroll to **Environment Variables**. Click **Add another** for each row marked ✅:

| Name                                | Value                                                  |
| ----------------------------------- | ------------------------------------------------------ |
| ✅ `NEXT_PUBLIC_SUPABASE_URL`       | (from Supabase, Part 1.3)                              |
| ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | (from Supabase, Part 1.3)                              |
| ✅ `SUPABASE_SERVICE_ROLE_KEY`      | (from Supabase, Part 1.3)                              |
| ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | (from Stripe, Part 2.3 — test key is fine for now) |
| ✅ `STRIPE_SECRET_KEY`              | (from Stripe, Part 2.3 — test key is fine for now)     |
| ✅ `VAPID_SUBJECT`                  | `mailto:tommy.stegmaier@life.church`                   |
| ⏳ `STRIPE_WEBHOOK_SECRET`          | skip for now — you'll add it in Part 3.6               |
| ⏳ `NEXT_PUBLIC_SITE_URL`           | skip for now — you'll add it in Part 3.5               |
| ⏳ `NEXT_PUBLIC_VAPID_PUBLIC_KEY`   | skip for now — you'll add it in Part 3.7               |
| ⏳ `VAPID_PRIVATE_KEY`              | skip for now — you'll add it in Part 3.7               |

### 3.4 Deploy

1. Click **Deploy**.
2. Wait 1–3 minutes. Vercel will build and deploy.
3. When it's done, you'll see a **success screen** with a live URL like
   `https://rentalmap-abc123.vercel.app`. Click it — you should see the
   Rentalmap landing page.

### 3.5 Set the public URL, then redeploy

1. Copy your live URL (without the trailing slash).
2. In Vercel, go to **Settings → Environment Variables**.
3. Click **Add New** and add `NEXT_PUBLIC_SITE_URL` with the value of your live
   URL (e.g., `https://rentalmap-abc123.vercel.app`).
4. We'll come back for `STRIPE_WEBHOOK_SECRET` and the VAPID keys in a moment.

### 3.6 Register the Stripe webhook (event destination)

Webhooks are how Stripe tells your app "the payment went through." Without this
your rent payments won't be marked as settled.

> Stripe recently renamed **Webhooks** to **Event destinations**. The flow has
> a few more screens than before — same endpoint, same events, just split
> across three wizard steps.

1. Stripe dashboard → **Developers → Event destinations** (formerly **Webhooks**).
2. Click **+ Add destination** (or **Create destination**).

**Wizard step 1 — Select events:**

3. **Event destination scope**: pick **Your account** — NOT "Connected
   accounts." Our app uses destination charges, so payment events fire on the
   platform (your account), not on the landlord's connected account.
4. **API version**: leave the default.
5. **Events**: click **+ Select events** and check all four:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.payment_succeeded` (this one is for auto-pay)
6. Click **Continue**.

**Wizard step 2 — Choose destination type:**

7. Pick **Webhook endpoint** (sometimes labeled **HTTPS endpoint**).

**Wizard step 3 — Configure your destination:**

8. **Endpoint URL**: `https://YOUR-VERCEL-URL.vercel.app/api/stripe/webhook`
   (paste your real Vercel URL).
9. Click **Create destination**.

**After creation:**

10. On the destination detail page, find the **Signing secret** section. Click
    **Reveal** and copy the value (starts with `whsec_`).
11. In **Vercel → Settings → Environment Variables**, click **Add New**:
    - Name: `STRIPE_WEBHOOK_SECRET`
    - Value: paste the `whsec_...` secret

> **You'll do this twice eventually.** What you just set up is the **sandbox
> (test mode)** webhook. Once Stripe activates your account and you switch
> Vercel to live keys (`sk_live_` / `pk_live_`), redo this flow in **Live
> mode** (toggle top-right of the Stripe dashboard) and replace
> `STRIPE_WEBHOOK_SECRET` in Vercel with the new live signing secret.

### 3.7 Generate push-notification keys (VAPID)

Push notifications need a one-time generated key pair. The simplest way:

1. On your **laptop** open a terminal (Mac: open Spotlight, type "Terminal").
2. Run:

   ```
   npx web-push generate-vapid-keys
   ```

3. It prints two values:
   ```
   Public Key:  BCx...
   Private Key: K8y...
   ```
4. In Vercel → Settings → Environment Variables:
   - **Edit** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and paste the Public Key
   - **Edit** `VAPID_PRIVATE_KEY` and paste the Private Key

> Don't share the private key. It's the secret that proves notifications come
> from your app.

### 3.8 Redeploy so the new env vars take effect

1. In Vercel, click **Deployments** (top tab).
2. Click the **…** (three dots) next to the most recent deployment.
3. Click **Redeploy** → **Redeploy** again. Wait 1–2 minutes.

### 3.9 Tell Supabase about your live URL

Supabase Auth blocks any sign-in or email-confirmation link that redirects to
a URL not on its allowlist. By default that allowlist is just `localhost`, so
we need to add your Vercel URL.

1. Supabase dashboard → your **Rentalmap** project.
2. Left sidebar → **Authentication** → **URL Configuration**.
3. **Site URL**: set to your Vercel URL (no trailing slash):
   ```
   https://YOUR-VERCEL-URL.vercel.app
   ```
4. **Redirect URLs**: click **Add URL** and add this wildcard:
   ```
   https://YOUR-VERCEL-URL.vercel.app/**
   ```
   (The `/**` is a wildcard — it whitelists every path under your domain so
   `/auth/callback`, `/landlord`, etc. all work.)
5. Click **Save**.

> If you skip this, signup looks broken: you'll see "invalid path specified in
> request URL" or the confirmation email link will land on an error page.

Vercel is now configured. Your app is live!

---

## Part 3.5 — Branded emails (optional but recommended) · ~15 min

By default, invitation and password-reset emails arrive from "Supabase Auth"
with plain-text content, which looks unpolished. To send them from
**Rentalmap** with branded HTML, follow the dedicated guide at
`supabase/email-templates/README.md` — short version:

1. Sign up at https://resend.com (free, 3,000 emails/month)
2. Get an API key, paste it into Supabase → **Authentication → Emails → SMTP**
3. Paste the 5 HTML files from `supabase/email-templates/` into Supabase's
   **Authentication → Emails → Templates**

You can skip this and come back later — the app still works with the default
emails. Tenants will just see them coming from "Supabase Auth", which feels
generic.

---

## Part 4 — First-time app setup · ~10 min

### 4.1 Create your landlord account

1. On your iPhone or laptop, open your live URL (e.g., `https://rentalmap-abc123.vercel.app`).
2. Tap **Get started as landlord**.
3. Fill in:
   - Full name: `Tommy Stegmaier`
   - Email: your real email (this is what you'll use to sign in)
   - Password: anything you'll remember (min 8 characters)
4. Tap **Create account**.
5. **Check your email** — Supabase sends a confirmation link. Click it.
6. Now go back to the app and **sign in**.

### 4.2 Load the Holmes St property + Rose lease

This is the only step that requires touching the database directly. We'll
substitute your user ID into the seed file.

1. Open your **Supabase tab** → **Authentication** (left sidebar).
2. Find your row (your email) and copy the **User UID** (a long string of letters,
   numbers, and dashes — looks like `f47ac10b-58cc-...`).
3. Click **SQL Editor** → **New query**.
4. Open `supabase/seed.sql` from the repo. **Copy its contents.**
5. Paste into the SQL Editor. **Find the line** that has `:'owner_id'::uuid` near
   the top of the `do $$` block, and **replace** that whole expression with your
   UID in quotes. So this:

   ```sql
   v_owner_id uuid := :'owner_id'::uuid;
   ```

   becomes:

   ```sql
   v_owner_id uuid := 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid;
   ```

   (using your actual UID, of course).
6. Click **Run**. You should see "Success. No rows returned" with a notice like
   `Seeded property ... with lease ...`.

Refresh your live app. You should see Holmes St on the dashboard.

### 4.3 Connect Stripe inside the app

1. In the app, tap **More** → **Settings**.
2. Tap **Connect Stripe account**. You'll be redirected to Stripe's secure
   onboarding.
3. Verify your identity and bank (most fields will be pre-filled if you already
   activated Stripe in Part 2.2).
4. When done, Stripe redirects you back to the app. You'll see the badge change
   to **connected**.

### 4.4 Invite Matthew and Brittany

1. In the app, tap **More** → **Invite tenant**.
2. **Lease**: it's pre-selected (the Holmes St lease).
3. **Tenant email**: enter Matthew's email.
4. Tap **Send invitation**.
5. Repeat for Brittany's email.

They'll each get an email from Supabase with a magic-link sign-in. The moment
they click it, they're signed in **and** automatically linked to the lease — no
manual step on your side.

---

## Part 5 — Install on iPhone · ~1 min per person

The app is a **Progressive Web App** — it installs to the home screen with no App
Store, no review process, no installation fee.

### For you (the landlord)

1. Open **Safari** on your iPhone (Safari specifically — Chrome and Firefox can't
   install PWAs on iOS).
2. Go to your live URL (`https://rentalmap-abc123.vercel.app`).
3. Sign in.
4. Tap the **Share** button (the square with the arrow pointing up, at the
   bottom of the Safari screen).
5. Scroll the share sheet and tap **Add to Home Screen**.
6. Tap **Add** in the top-right corner.

The Rentalmap icon will appear on your home screen. Tap it to launch — it opens
full-screen like a real app, no Safari URL bar.

### Turn on push notifications (do this AFTER installing to home screen)

iOS only delivers push notifications to PWAs that are launched from the home
screen icon — not from Safari. So:

1. Tap the **Rentalmap home-screen icon** to open the app.
2. Go to **More → Settings** (landlord) or **More → Profile** (tenant).
3. Scroll to **Push notifications** and tap **Enable notifications**.
4. iOS will ask permission — tap **Allow**.

From here on you'll get a push for:
- New work orders (landlord)
- Rent payments that clear or fail (both sides)
- Reminders firing (rent due, lease renewal, inspections, HVAC, smoke/CO)

### For Matthew and Brittany

In the invitation email, give them this 30-second instruction (you can copy/paste
the block below into a text):

> Hey — here's how to install your landlord's app on your iPhone. Should take
> under a minute.
>
> 1. Open **Safari** (not Chrome) on your iPhone.
> 2. Tap the magic link in the invite email from Rentalmap. You'll be signed in
>    automatically.
> 3. Tap the **Share** button (square with the arrow at the bottom of Safari).
> 4. Tap **Add to Home Screen**.
> 5. Tap **Add**.
>
> You'll see a Rentalmap icon on your home screen. Tap to open. From there you
> can pay rent, submit a maintenance request, see your lease, and message me.

---

## You're live

After Part 5 you have:

- A live URL for the app
- An installed icon on your iPhone
- An installed icon on your tenants' iPhones (once they accept the invite)
- A connected Stripe account that deposits rent straight to your bank
- A Supabase database with your property and lease loaded

## Daily use, in plain English

- **A tenant pays rent**: they tap the icon, tap **Pay Rent**, choose ACH or
  card. The money lands in your bank account in 1–3 business days (ACH) or
  immediately (card, minus 2.9% + $0.30).
- **A tenant submits a maintenance request**: they tap the icon, **Maintenance →
  New**, pick the type (plumbing, electrical, HVAC, etc.) and urgency, write a
  description, snap up to 5 photos, hit submit. You see it instantly in your
  Maintenance inbox.
- **You log a Zelle/Venmo payment**: open the app, **Rent → Log payment**, fill
  in amount + date + method, save. Takes about 10 seconds.
- **You photograph a receipt**: **More → Expenses → Add**, snap the photo, pick
  a category (Repairs, Insurance, etc.), save. About 20 seconds.
- **A tenant sets up auto-pay**: in their app, **Pay Rent → Set up auto-pay**.
  They authorize Stripe to charge monthly; they get a confirmation each time it
  runs; you get a push notification when funds clear. They can cancel from the
  same screen any time.
- **A tenant or you need a payment receipt**: in any payment list (Rent
  ledger for you, Payment history for them), tap the **PDF** / **Receipt**
  link. A PDF receipt downloads.
- **Tax season**: **More → Reports** shows a Schedule E preview, and the
  **Tax export** button in the header downloads a zip with the Schedule E PDF,
  expense and rent CSVs, and every receipt photo from the year.
- **A reminder fires**: lease renewal, quarterly inspection, HVAC service,
  smoke/CO check — you get a push on the trigger date and see the item in
  **More → Reminders**.

## Troubleshooting

- **"Your project's URL and Key are required" error**: the env vars in Vercel
  aren't saved. Go to Settings → Environment Variables, double-check the three
  Supabase vars, then redeploy.
- **"Invalid path specified in request URL" on signup**: Supabase Auth doesn't
  have your Vercel URL on its allowlist. Do Part 3.9.
- **The Pay Rent button shows "Your landlord hasn't finished connecting"**:
  finish the Stripe Connect onboarding in Settings.
- **Stripe webhook says "no signing secret"**: you skipped Part 3.6. Go back and
  register the webhook + paste the secret in Vercel.
- **A tenant signed in but doesn't see their lease**: they probably signed up
  with a different email than you invited. Resend the invite to the email they
  actually used, or update their email in Supabase → Authentication → click their
  row → edit email.
- **You moved or restarted the project**: redeploy in Vercel (Deployments → …
  → Redeploy). Env vars persist; deployments don't auto-restart.

## What's still on the list

The big features (push, auto-pay, reminders, receipts, tax export) are all live
as of this guide. Remaining nice-to-haves:

- **Documents vault upload UI** (storage policies and table are ready, but the
  upload screen is still a placeholder)
- **JSON restore + CSV expense import** (backup export already works)
- **Dark mode toggle** (CSS variables are in place, just needs a switch)
- **OCR receipt scanning** to auto-fill amount and vendor

Ping me with what's blocking you and we'll prioritize.
