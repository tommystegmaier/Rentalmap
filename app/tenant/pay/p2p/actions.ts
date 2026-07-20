'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';
import { sendPushToUser } from '@/lib/push';
import { isP2PMethod, P2P_LABELS } from '@/lib/p2p';

export async function submitP2PClaim(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const lease_id = String(formData.get('lease_id'));
  const expected_date = String(formData.get('expected_date'));
  const methodRaw = String(formData.get('method') ?? 'venmo');
  const method = isP2PMethod(methodRaw) ? methodRaw : 'venmo';
  const venmo_note = String(formData.get('note') ?? '').trim() || null;

  if (!lease_id || !expected_date) throw new Error('Missing required fields');

  // Verify tenant is on this lease
  const { data: link } = await supabase
    .from('lease_tenants')
    .select('lease_id, leases:lease_id(monthly_rent_cents)')
    .eq('user_id', user.id)
    .eq('lease_id', lease_id)
    .maybeSingle();
  if (!link) throw new Error('Forbidden');

  const leaseRow = Array.isArray(link.leases) ? link.leases[0] : link.leases;
  const rentCents = (leaseRow as { monthly_rent_cents: number } | null)?.monthly_rent_cents ?? 0;

  // Recompute outstanding late fees server-side rather than trusting the client,
  // so the recorded amount and the fees marked paid on approval always match.
  const { data: feeData } = await supabase
    .from('late_fee_charges')
    .select('id, amount_cents')
    .eq('lease_id', lease_id)
    .eq('waived', false)
    .eq('paid', false);
  const lateFeeIds = (feeData ?? []).map((f: { id: string }) => f.id);
  const lateFeesCents = (feeData ?? []).reduce(
    (s: number, f: { amount_cents: number }) => s + f.amount_cents,
    0,
  );
  const amount_cents = rentCents + lateFeesCents;

  if (!amount_cents) throw new Error('Missing required fields');

  const { data: insertedClaim, error } = await supabase
    .from('venmo_payment_claims')
    .insert({
      lease_id,
      tenant_user_id: user.id,
      amount_cents,
      late_fees_cents: lateFeesCents,
      late_fee_ids: lateFeeIds,
      expected_date,
      method,
      venmo_note,
    })
    .select('id')
    .maybeSingle();
  if (error) throw error;

  const methodLabel = P2P_LABELS[method];

  // Notify the landlord via service role (tenant can't read landlord row).
  const admin = createServiceRoleClient();
  const { data: lease } = await admin
    .from('leases')
    .select('property_id, properties:property_id(owner_id, address)')
    .eq('id', lease_id)
    .maybeSingle();
  const prop = Array.isArray(lease?.properties) ? lease.properties[0] : lease?.properties;

  if (prop?.owner_id) {
    const { data: tenant } = await admin
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .maybeSingle();
    const tenantName = tenant?.name ?? tenant?.email ?? 'Your tenant';
    const title = `${methodLabel} payment claim — ${prop.address ?? 'property'}`;
    const body = `${tenantName} says they sent a ${methodLabel} payment. Tap to approve or deny.`;
    const url = '/landlord/rent';

    try {
      await createNotification(admin, prop.owner_id, {
        type: 'venmo_claim_submitted',
        title,
        body,
        url,
        related_id: insertedClaim?.id,
      });
    } catch {}

    await sendPushToUser(prop.owner_id, { title, body, url, tag: `p2p-claim-${lease_id}` });
  }

  revalidatePath('/tenant/pay');
}
