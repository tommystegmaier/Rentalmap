import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { z } from 'zod';

const Body = z.object({ autopay_id: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Confirm ownership via RLS first.
  const { data: autopay } = await supabase
    .from('autopay_subscriptions')
    .select('id, stripe_subscription_id, tenant_user_id')
    .eq('id', parsed.data.autopay_id)
    .maybeSingle();
  if (!autopay) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (autopay.tenant_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(autopay.stripe_subscription_id);
  } catch {
    // If Stripe says it's already canceled, that's fine — still update DB.
  }

  const admin = createServiceRoleClient();
  await admin
    .from('autopay_subscriptions')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', autopay.id);

  return NextResponse.json({ ok: true });
}
