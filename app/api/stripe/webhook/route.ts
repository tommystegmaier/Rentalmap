import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad signature' },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.metadata?.type !== 'rent') break;

      const leaseId = session.metadata.lease_id;
      const expectedDate =
        session.metadata.expected_date ?? new Date().toISOString().slice(0, 10);
      const tenantUserId = session.metadata.tenant_user_id ?? null;
      const amount = session.amount_total ?? 0;
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

      const method = session.payment_method_types?.includes('us_bank_account')
        ? 'ach'
        : 'card';

      // Avoid duplicates if Stripe retries the webhook.
      const { data: existing } = paymentIntentId
        ? await supabase
            .from('rent_payments')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .maybeSingle()
        : { data: null };

      if (!existing) {
        await supabase.from('rent_payments').insert({
          lease_id: leaseId,
          expected_date: expectedDate,
          received_date: null,
          amount_cents: amount,
          method,
          stripe_payment_intent_id: paymentIntentId,
          status: 'pending',
          recorded_by: tenantUserId,
          notes: 'Submitted via Stripe Checkout',
        });
      }
      break;
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      await supabase
        .from('rent_payments')
        .update({
          status: 'settled',
          received_date: new Date().toISOString().slice(0, 10),
        })
        .eq('stripe_payment_intent_id', pi.id);
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      await supabase
        .from('rent_payments')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', pi.id);
      break;
    }

    default:
      // Other events ignored.
      break;
  }

  return NextResponse.json({ received: true });
}
