# Email branding setup

Two things need to happen for emails to feel like Rentalmap:

1. **Custom SMTP** so the sender shows as "Rentalmap" instead of "Supabase Auth"
2. **Custom HTML templates** so the content matches the app's design

Plan on ~15 minutes total, one-time.

---

## Part 1 — Custom SMTP via Resend (free)

Resend has a free tier (3,000 emails/month, 100/day) and the easiest setup.

### 1.1 Create a Resend account

1. Go to https://resend.com → **Sign up**
2. Confirm your email
3. From the dashboard, in the left sidebar, click **API Keys** → **Create API Key**
4. Name: `Rentalmap Supabase`, Permission: **Sending access**, Domain: leave at "All domains"
5. Click **Add** → **copy the API key** that appears (starts with `re_...`) — it's only shown once

### 1.2 Verify a sender domain (optional but recommended)

You can skip this and use Resend's shared `onboarding@resend.dev` sender, but emails will say "via resend.dev" in most inboxes — which doesn't look professional. Once you have a custom domain (e.g. `rentalmap.app`), come back and:

1. Resend dashboard → **Domains** → **Add Domain** → enter your domain
2. Resend gives you DNS records (SPF, DKIM) — add them to your domain registrar (Namecheap, Cloudflare, etc.)
3. Wait 5–10 minutes for verification

For now, skip this step.

### 1.3 Add Resend SMTP to Supabase

1. Supabase dashboard → your **Rentalmap** project
2. Left sidebar → **Authentication** → **Emails** → **SMTP Settings** tab
3. Toggle **Enable Custom SMTP** ON
4. Fill in:
   - **Sender email**: `onboarding@resend.dev` (or your custom domain like `noreply@rentalmap.app` once verified)
   - **Sender name**: `Rentalmap`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: paste the API key from step 1.1
5. Click **Save**

That's it for SMTP. Emails will now arrive from "Rentalmap <onboarding@resend.dev>" instead of "Supabase Auth".

### 1.4 (Optional) Tighten the rate limit

Supabase rate-limits emails to prevent abuse — defaults are usually fine for a single landlord with a handful of tenants. To bump:

1. Same screen → scroll to **Rate Limits**
2. Adjust if you need (e.g. 30 emails per hour is plenty)

---

## Part 2 — Branded HTML templates

Each template file in this directory goes into a specific slot in Supabase. The slot name and file name don't quite match — use the table below.

### 2.1 Open the Email Templates section

Supabase dashboard → **Authentication** → **Emails** → **Templates** tab (next to "SMTP Settings")

You'll see a list of template types in the left sidebar:
- Confirm signup
- Invite user
- Magic Link
- Change Email Address
- Reset Password
- (and a few others — leave those alone)

### 2.2 Paste each template

For each row in the table below:

1. Click the **template name** in Supabase's left sidebar
2. **Subject heading** → paste the value from the "Subject" column
3. **Message body** → switch to the **HTML** view (it's the default), select all existing content, paste the contents of the corresponding file
4. Click **Save changes** at the bottom

| Supabase template name | File to paste | Suggested Subject heading |
| --- | --- | --- |
| **Invite user** | `invite.html` | You're invited to Rentalmap |
| **Magic Link** | `magic-link.html` | Sign in to Rentalmap |
| **Confirm signup** | `confirm-signup.html` | Confirm your Rentalmap account |
| **Reset Password** | `reset-password.html` | Reset your Rentalmap password |
| **Change Email Address** | `email-change.html` | Confirm your new email on Rentalmap |

### 2.3 Test it

After saving:

1. Open the live app → **More → Invite tenant** → invite yourself at a different email
2. Check that email — should show:
   - Sender: **Rentalmap** (not "Supabase Auth")
   - Subject: **You're invited to Rentalmap**
   - Branded HTML with the house+map-pin logo, light-blue button, etc.

If something looks off, return to the template in Supabase and adjust.

---

## How the variables work

Inside the templates you'll see `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, etc. — those are Supabase Auth template variables. The most useful:

| Variable | What it expands to |
| --- | --- |
| `{{ .ConfirmationURL }}` | The unique signed link the user taps to verify |
| `{{ .SiteURL }}` | The Site URL from Supabase Authentication → URL Configuration (used to load the logo) |
| `{{ .Email }}` | The recipient's email |
| `{{ .Data.landlord_name }}` | The landlord's display name (set by Rentalmap's invite flow) |
| `{{ .Data.property_address }}` | The property's address (set by Rentalmap's invite flow) |

The invite template uses `{{ if .Data.landlord_name }}...{{ end }}` blocks to gracefully handle missing data — if for some reason a custom variable isn't set, the email falls back to generic copy.

---

## Going further

- **Custom domain** — once you own a domain (e.g. `rentalmap.app`), set up Resend domain verification (Part 1.2) and switch the sender to `noreply@yourdomain.com`. Greatly improves deliverability and removes the `via resend.dev` chrome.
- **Reply-to address** — Supabase doesn't expose this directly, but you can set up `mail.rentalmap.app` with Resend's inbound parsing if you want tenants to reply to messages.
- **Other providers** — if you'd rather use SendGrid, Postmark, AWS SES, or Mailgun, the SMTP settings are nearly identical; just swap the host/port/credentials in Part 1.3.
