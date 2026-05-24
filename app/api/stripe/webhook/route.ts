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
      // Other events ignored for now.
      break;
  }

  return NextResponse.json({ received: true });
}
