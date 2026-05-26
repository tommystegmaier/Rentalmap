'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';
import { sendPushToUser } from '@/lib/push';

export async function submitVenmoClaim(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const lease_id = String(formData.get('lease_id'));
  const amount_cents = parseInt(String(formData.get('amount_cents')), 10);
  const expected_date = String(formData.get('expected_date'));
  const venmo_note = String(formData.get('venmo_note') ?? '').trim() || null;

  if (!lease_id || !amount_cents || !expected_date) throw new Error('Missing required fields');

  // Verify tenant is on this lease
  const { data: link } = await supabase
    .from('lease_tenants')
    .select('lease_id')
    .eq('user_id', user.id)
    .eq('lease_id', lease_id)
    .maybeSingle();
  if (!link) throw new Error('Forbidden');

  const { error } = await supabase.from('venmo_payment_claims').insert({
    lease_id,
    tenant_user_id: user.id,
    amount_cents,
    expected_date,
    venmo_note,
  });
  if (error) throw error;

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
    const title = `Venmo payment claim — ${prop.address ?? 'property'}`;
    const body = `${tenantName} says they sent a Venmo payment. Tap to approve or deny.`;
    const url = '/landlord/rent';

    try {
      await createNotification(admin, prop.owner_id, {
        type: 'venmo_claim_submitted',
        title,
        body,
        url,
      });
    } catch {}

    await sendPushToUser(prop.owner_id, { title, body, url, tag: `venmo-claim-${lease_id}` });
  }

  revalidatePath('/tenant/pay');
}
