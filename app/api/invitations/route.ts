import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';

const InviteSchema = z.object({
  lease_id: z.string().uuid(),
  email: z.string().email().transform((v) => v.toLowerCase()),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { lease_id, email } = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Guard against inviting yourself — creates a confusing dual-role state and
  // is almost always a testing mistake.
  if (user.email && user.email.toLowerCase() === email) {
    return NextResponse.json(
      {
        error:
          "You can't invite your own landlord email as a tenant. For testing, use a different inbox (a Gmail alias like you+test@gmail.com works).",
      },
      { status: 400 },
    );
  }

  // Caller must own the property on the lease. Pull the property address so
  // we can pass it to the invite email template.
  const { data: lease, error: leaseErr } = await supabase
    .from('leases')
    .select('id, properties:property_id(owner_id, address)')
    .eq('id', lease_id)
    .maybeSingle();

  if (leaseErr || !lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
  }
  const props = lease.properties as
    | { owner_id: string; address: string }
    | { owner_id: string; address: string }[]
    | null;
  const prop = Array.isArray(props) ? props[0] : props;
  if (prop?.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createServiceRoleClient();

  // Check whether this invitation has already been accepted. If so, we still
  // resend the magic-link email (tenant may need a new sign-in link) but we
  // must NOT flip status back to 'pending' — that would turn their badge gray.
  const { data: existingInvite } = await admin
    .from('tenant_invitations')
    .select('status')
    .eq('lease_id', lease_id)
    .ilike('email', email)
    .maybeSingle();

  if (existingInvite?.status !== 'accepted') {
    // Use admin client to avoid RLS issues on upsert
    const { error: invErr } = await admin
      .from('tenant_invitations')
      .upsert(
        { landlord_id: user.id, lease_id, email, status: 'pending' },
        { onConflict: 'lease_id,email', ignoreDuplicates: false },
      );
    if (invErr) {
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }
  }

  // Fetch landlord's display name for the email template.
  const { data: landlord } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', user.id)
    .maybeSingle();
  const landlordName = landlord?.name ?? landlord?.email ?? 'Your landlord';
  const propertyAddress = prop?.address ?? '';

  // Send magic link via service role admin API.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          'Service role key not configured. Invitation was recorded but no email was sent.',
      },
      { status: 200 },
    );
  }

  try {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const emailRedirectTo = `${siteUrl}/auth/callback?to=welcome`;
    const inviteData = {
      role: 'tenant',
      lease_id,
      landlord_name: landlordName,
      property_address: propertyAddress,
    };

    // Primary path: inviteUserByEmail works for new users and previously-invited
    // (unconfirmed) users. The admin endpoint is not subject to the per-user
    // 60-second OTP rate limit.
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: emailRedirectTo,
      data: inviteData,
    });

    if (!inviteErr) {
      return NextResponse.json({ ok: true });
    }

    // Fallback for confirmed users ("User already registered"):
    // Generate a fresh magic link via the admin generate_link endpoint, which
    // bypasses user-registration checks and rate limits.
    const { data: linkData, error: linkGenErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: emailRedirectTo, data: inviteData },
    });

    if (!linkGenErr && linkData?.properties?.action_link) {
      // Best-effort: try sending via OTP (may be rate-limited if recently sent).
      const { error: otpErr } = await admin.auth.signInWithOtp({
        email,
        options: { emailRedirectTo, data: inviteData },
      });

      if (!otpErr) {
        // OTP email sent — tenant will get the magic link in their inbox.
        return NextResponse.json({ ok: true });
      }

      // OTP was rate-limited or failed. Return the generated link so the
      // landlord can copy and share it with the tenant directly.
      return NextResponse.json({
        ok: true,
        inviteLink: linkData.properties.action_link,
      });
    }

    // Both paths failed — surface the original invite error.
    return NextResponse.json(
      { error: friendlyInviteError(inviteErr.message) },
      { status: 500 },
    );
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Failed to send invitation';
    return NextResponse.json({ error: friendlyInviteError(raw) }, { status: 500 });
  }
}

function friendlyInviteError(raw: string): string {
  // Per-user 60-second cool-down (the 'Minimum interval per user' setting in
  // Supabase Authentication → Emails → SMTP Settings). Still applies even
  // with custom SMTP configured.
  if (
    /for security purposes.*after \d+ second|seconds before|too many requests/i.test(
      raw,
    )
  ) {
    return (
      "Supabase enforces a per-recipient cool-down (60 seconds by default). " +
      'Wait a minute, or use a fresh email address. ' +
      "You can adjust the interval in Supabase → Authentication → Emails → SMTP Settings."
    );
  }
  // Supabase surfaces several different wordings for the same underlying
  // outbound-email failure. Catch all of them.
  if (
    /sending (magic link|confirmation|invite|signup|recovery|email_change) email/i.test(
      raw,
    ) ||
    /email rate limit|over.*email.*limit|rate limit exceeded/i.test(raw)
  ) {
    return (
      "Email send failed. Possible causes: Supabase's per-recipient cool-down (60 seconds), " +
      'a misconfigured SMTP provider (check Authentication → Emails → SMTP Settings), or ' +
      'Supabase\'s default rate-limit (3/hour) if custom SMTP is off. Raw error: ' +
      raw
    );
  }
  if (/smtp/i.test(raw)) {
    return `Email send failed (${raw}). Check Supabase → Authentication → Emails → SMTP Settings.`;
  }
  return raw;
}
