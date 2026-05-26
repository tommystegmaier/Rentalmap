'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';
import { createNotification } from '@/lib/notifications';

export async function approveClaim(claimId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const admin = createServiceRoleClient();
  const { data: claim } = await admin
    .from('venmo_payment_claims')
    .select('id, lease_id, tenant_user_id, amount_cents, expected_date')
    .eq('id', claimId)
    .eq('status', 'pending')
    .maybeSingle();
  if (!claim) throw new Error('Claim not found or already reviewed');

  const { data: lease } = await admin
    .from('leases')
    .select('property_id, properties:property_id(owner_id)')
    .eq('id', claim.lease_id)
    .maybeSingle();
  const prop = Array.isArray(lease?.properties) ? lease.properties[0] : lease?.properties;
  if (prop?.owner_id !== user.id) throw new Error('Forbidden');

  const today = new Date().toISOString().split('T')[0];

  await Promise.all([
    admin.from('rent_payments').insert({
      lease_id: claim.lease_id,
      expected_date: claim.expected_date,
      received_date: today,
      amount_cents: claim.amount_cents,
      method: 'venmo',
      status: 'manual',
      recorded_by: user.id,
    }),
    admin
      .from('venmo_payment_claims')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq('id', claimId),
    createNotification(admin, claim.tenant_user_id, {
      type: 'venmo_claim_reviewed',
      title: 'Venmo payment confirmed',
      body: 'Your landlord confirmed receipt of your Venmo payment. Rent is logged as paid.',
      url: '/tenant/pay',
      related_id: claimId,
    }),
  ]);

  await sendPushToUser(claim.tenant_user_id, {
    title: 'Venmo payment confirmed ✓',
    body: 'Your landlord confirmed receipt of your Venmo payment. Rent is logged as paid.',
    url: '/tenant/pay',
    tag: `venmo-approved-${claimId}`,
  });

  revalidatePath('/landlord/rent');
  revalidatePath('/landlord');
}

export async function denyClaim(claimId: string, reason?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const admin = createServiceRoleClient();
  const { data: claim } = await admin
    .from('venmo_payment_claims')
    .select('id, lease_id, tenant_user_id')
    .eq('id', claimId)
    .eq('status', 'pending')
    .maybeSingle();
  if (!claim) throw new Error('Claim not found or already reviewed');

  const { data: lease } = await admin
    .from('leases')
    .select('property_id, properties:property_id(owner_id)')
    .eq('id', claim.lease_id)
    .maybeSingle();
  const prop = Array.isArray(lease?.properties) ? lease.properties[0] : lease?.properties;
  if (prop?.owner_id !== user.id) throw new Error('Forbidden');

  const reasonText = reason?.trim() ? ` Reason: ${reason.trim()}` : ' Please contact your landlord.';
  const notifBody = `Your landlord could not verify the payment.${reasonText}`;

  await Promise.all([
    admin
      .from('venmo_payment_claims')
      .update({
        status: 'denied',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        denial_reason: reason?.trim() || null,
      })
      .eq('id', claimId),
    createNotification(admin, claim.tenant_user_id, {
      type: 'venmo_claim_reviewed',
      title: 'Venmo payment not confirmed',
      body: notifBody,
      url: '/tenant/pay',
      related_id: claimId,
    }),
  ]);

  await sendPushToUser(claim.tenant_user_id, {
    title: 'Venmo payment not confirmed',
    body: notifBody,
    url: '/tenant/pay',
    tag: `venmo-denied-${claimId}`,
  });

  revalidatePath('/landlord/rent');
  revalidatePath('/landlord');
}

