import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToLandlord, sendPushToUser } from '@/lib/push';
import { formatCents } from '@/lib/utils';

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

      if (session.metadata?.type === 'rent_autopay_setup' && session.subscription) {
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
        const sub = await getStripe().subscriptions.retrieve(subId, {
          expand: ['default_payment_method'],
        });
        const pm =
          typeof sub.default_payment_method === 'string'
            ? sub.default_payment_method
            : sub.default_payment_method?.id ?? null;
        const customer =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

        await supabase.from('autopay_subscriptions').upsert(
          {
            lease_id: session.metadata.lease_id,
            tenant_user_id: session.metadata.tenant_user_id,
            stripe_customer_id: customer,
            stripe_subscription_id: subId,
            stripe_payment_method_id: pm,
            status: 'active',
          },
          { onConflict: 'lease_id,tenant_user_id' },
        );
        break;
      }

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
      const { data: updated } = await supabase
        .from('rent_payments')
        .update({
          status: 'settled',
          received_date: new Date().toISOString().slice(0, 10),
        })
        .eq('stripe_payment_intent_id', pi.id)
        .select('id, lease_id, amount_cents, recorded_by')
        .maybeSingle();

      if (updated) {
        const { data: lease } = await supabase
          .from('leases')
          .select('property_id, properties:property_id(address)')
          .eq('id', updated.lease_id)
          .maybeSingle();
        const propAddr =
          (Array.isArray(lease?.properties) ? lease?.properties[0] : lease?.properties)
            ?.address ?? '';

        if (lease?.property_id) {
          await sendPushToLandlord(lease.property_id, {
            title: `Rent received · ${formatCents(updated.amount_cents)}`,
            body: propAddr,
            url: '/landlord/rent',
            tag: `pay-${updated.id}`,
          });
        }
        if (updated.recorded_by) {
          await sendPushToUser(updated.recorded_by, {
            title: 'Rent payment cleared',
            body: `${formatCents(updated.amount_cents)} · ${propAddr}`,
            url: '/tenant/payments',
            tag: `pay-tenant-${updated.id}`,
          });
        }
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const { data: failed } = await supabase
        .from('rent_payments')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', pi.id)
        .select('id, lease_id, recorded_by, amount_cents')
        .maybeSingle();

      if (failed?.recorded_by) {
        await sendPushToUser(failed.recorded_by, {
          title: 'Rent payment failed',
          body: 'Please try a different payment method.',
          url: '/tenant/pay',
          tag: `fail-${failed.id}`,
        });
      }
      if (failed?.lease_id) {
        const { data: l } = await supabase
          .from('leases')
          .select('property_id')
          .eq('id', failed.lease_id)
          .maybeSingle();
        if (l?.property_id) {
          await sendPushToLandlord(l.property_id, {
            title: 'Rent payment failed',
            body: `${formatCents(failed.amount_cents)} attempt did not go through.`,
            url: '/landlord/rent',
            tag: `fail-landlord-${failed.id}`,
          });
        }
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      // Auto-pay subscription succeeded — log the payment.
      const invoice = event.data.object as {
        id: string;
        subscription: string | null;
        amount_paid: number;
        payment_intent: string | null;
        metadata?: Record<string, string>;
        lines?: { data: Array<{ metadata?: Record<string, string> }> };
      };
      if (!invoice.subscription) break;

      const { data: autopay } = await supabase
        .from('autopay_subscriptions')
        .select('lease_id, tenant_user_id')
        .eq('stripe_subscription_id', invoice.subscription)
        .maybeSingle();
      if (!autopay) break;

      const piId =
        typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null;

      if (piId) {
        // Skip duplicates if checkout webhook already created the row.
        const { data: existing } = await supabase
          .from('rent_payments')
          .select('id')
          .eq('stripe_payment_intent_id', piId)
          .maybeSingle();
        if (existing) break;
      }

      await supabase.from('rent_payments').insert({
        lease_id: autopay.lease_id,
        expected_date: new Date().toISOString().slice(0, 10),
        received_date: new Date().toISOString().slice(0, 10),
        amount_cents: invoice.amount_paid,
        method: 'ach',
        stripe_payment_intent_id: piId,
        status: 'settled',
        recorded_by: autopay.tenant_user_id,
        notes: 'Auto-pay (Stripe subscription)',
      });

      const { data: l } = await supabase
        .from('leases')
        .select('property_id, properties:property_id(address)')
        .eq('id', autopay.lease_id)
        .maybeSingle();
      const addr =
        (Array.isArray(l?.properties) ? l?.properties[0] : l?.properties)?.address ?? '';
      if (l?.property_id) {
        await sendPushToLandlord(l.property_id, {
          title: `Auto-pay rent received · ${formatCents(invoice.amount_paid)}`,
          body: addr,
          url: '/landlord/rent',
        });
      }
      break;
    }

    default:
      // Other events ignored.
      break;
  }

  return NextResponse.json({ received: true });
}
