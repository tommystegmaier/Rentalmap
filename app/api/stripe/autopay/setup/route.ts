import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { z } from 'zod';

const Body = z.object({ lease_id: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { lease_id } = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Tenant must be on this lease.
  const { data: link } = await supabase
    .from('lease_tenants')
    .select('lease_id')
    .eq('user_id', user.id)
    .eq('lease_id', lease_id)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createServiceRoleClient();
  const { data: lease } = await admin
    .from('leases')
    .select('id, monthly_rent_cents, due_day, properties(address, owner_id)')
    .eq('id', lease_id)
    .maybeSingle();
  if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

  const prop = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;
  if (!prop) return NextResponse.json({ error: 'Property missing' }, { status: 500 });

  const { data: landlord } = await admin
    .from('users')
    .select('stripe_connect_account_id')
    .eq('id', prop.owner_id)
    .maybeSingle();
  const destination = landlord?.stripe_connect_account_id;
  if (!destination) {
    return NextResponse.json(
      { error: "Your landlord hasn't connected their bank yet." },
      { status: 400 },
    );
  }

  // Reuse / create a Stripe Price for this lease + amount.
  const stripe = getStripe();
  const { data: existingPrice } = await admin
    .from('lease_stripe_prices')
    .select('stripe_price_id, amount_cents')
    .eq('lease_id', lease_id)
    .maybeSingle();

  let priceId = existingPrice?.stripe_price_id;
  if (!priceId || existingPrice?.amount_cents !== lease.monthly_rent_cents) {
    const product = await stripe.products.create({
      name: `Rent — ${prop.address}`,
      metadata: { lease_id },
    });
    const price = await stripe.prices.create({
      currency: 'usd',
      product: product.id,
      unit_amount: lease.monthly_rent_cents,
      recurring: { interval: 'month' },
    });
    priceId = price.id;
    await admin
      .from('lease_stripe_prices')
      .upsert(
        { lease_id, stripe_price_id: priceId, amount_cents: lease.monthly_rent_cents },
        { onConflict: 'lease_id' },
      );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'us_bank_account'],
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        description: `Auto-pay rent for ${prop.address}`,
        transfer_data: { destination },
        application_fee_percent: 0,
        metadata: {
          type: 'rent_autopay',
          lease_id,
          tenant_user_id: user.id,
        },
      },
      metadata: {
        type: 'rent_autopay_setup',
        lease_id,
        tenant_user_id: user.id,
      },
      success_url: `${origin}/tenant/pay?autopay=on`,
      cancel_url: `${origin}/tenant/pay`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe error' },
      { status: 500 },
    );
  }
}
