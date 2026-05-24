import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { z } from 'zod';

const BodySchema = z.object({
  lease_id: z.string().uuid(),
  expected_date: z.string(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { lease_id, expected_date } = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Tenant must be linked to this lease.
  const { data: link } = await supabase
    .from('lease_tenants')
    .select('lease_id')
    .eq('user_id', user.id)
    .eq('lease_id', lease_id)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Look up lease + landlord's Stripe Connect account via service role.
  const admin = createServiceRoleClient();
  const { data: lease, error: leaseErr } = await admin
    .from('leases')
    .select('id, monthly_rent_cents, properties(address, owner_id)')
    .eq('id', lease_id)
    .maybeSingle();
  if (leaseErr || !lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
  }

  const props = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;
  if (!props) return NextResponse.json({ error: 'Property missing' }, { status: 500 });

  const { data: landlord } = await admin
    .from('users')
    .select('stripe_connect_account_id')
    .eq('id', props.owner_id)
    .maybeSingle();

  const destination = landlord?.stripe_connect_account_id;
  if (!destination) {
    return NextResponse.json(
      {
        error:
          "Your landlord hasn't finished connecting their bank yet. Please pay via Zelle, Venmo, or check for now.",
      },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'us_bank_account'],
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `Rent — ${props.address}` },
            unit_amount: lease.monthly_rent_cents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        description: `Rent for ${props.address}`,
        transfer_data: { destination },
        on_behalf_of: destination,
      },
      metadata: {
        type: 'rent',
        lease_id,
        expected_date,
        tenant_user_id: user.id,
      },
      success_url: `${origin}/tenant/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/tenant/pay/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe error' },
      { status: 500 },
    );
  }
}
