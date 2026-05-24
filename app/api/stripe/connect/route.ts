import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

// POST /api/stripe/connect — creates a Stripe Express account onboarding link.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('stripe_connect_account_id, email')
    .eq('id', user.id)
    .maybeSingle();

  try {
    const stripe = getStripe();
    let accountId = profile?.stripe_connect_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile?.email ?? user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
          us_bank_account_ach_payments: { requested: true },
        },
      });
      accountId = account.id;
      await supabase
        .from('users')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', user.id);
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/landlord/settings`,
      return_url: `${origin}/landlord/settings?stripe=connected`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe error' },
      { status: 500 },
    );
  }
}
