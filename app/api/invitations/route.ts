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

  // Ensure caller is the landlord on the lease.
  const { data: lease, error: leaseErr } = await supabase
    .from('leases')
    .select('id, properties:property_id(owner_id)')
    .eq('id', lease_id)
    .maybeSingle();

  if (leaseErr || !lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
  }
  // Supabase nested selects come back as arrays even when there's one row.
  const props = lease.properties as
    | { owner_id: string }
    | { owner_id: string }[]
    | null;
  const ownerId = Array.isArray(props) ? props[0]?.owner_id : props?.owner_id;
  if (ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Insert (or update) invitation row.
  const { error: invErr } = await supabase
    .from('tenant_invitations')
    .insert({ landlord_id: user.id, lease_id, email, status: 'pending' });
  if (invErr && invErr.code !== '23505') {
    return NextResponse.json({ error: invErr.message }, { status: 500 });
  }

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
    const admin = createServiceRoleClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const { error: otpErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?to=welcome`,
      data: { role: 'tenant', lease_id },
    });
    if (otpErr) {
      // If the user already exists, fall back to a magic link.
      const { error: linkErr } = await admin.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${siteUrl}/auth/callback?to=welcome` },
      });
      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 500 });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send invitation' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
