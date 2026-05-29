'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';
import { createNotification } from '@/lib/notifications';

export async function saveFeePayerSettings(
  achFeePayer: 'landlord' | 'tenant',
  cardFeePayer: 'landlord' | 'tenant',
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Read current values so we can diff and only notify on actual changes.
  const { data: current } = await supabase
    .from('users')
    .select('ach_fee_payer, card_fee_payer')
    .eq('id', user.id)
    .maybeSingle();

  const { error } = await supabase
    .from('users')
    .update({ ach_fee_payer: achFeePayer, card_fee_payer: cardFeePayer })
    .eq('id', user.id);
  if (error) throw error;

  const achChanged = current?.ach_fee_payer !== achFeePayer;
  const cardChanged = current?.card_fee_payer !== cardFeePayer;
  if (!achChanged && !cardChanged) {
    revalidatePath('/landlord/settings');
    return;
  }

  // Build the notification message describing what changed.
  const lines: string[] = [];
  if (achChanged) {
    lines.push(
      achFeePayer === 'tenant'
        ? 'Bank (ACH) payments now include a $0.80 processing fee.'
        : 'Bank (ACH) payments are now fee-free for you.',
    );
  }
  if (cardChanged) {
    lines.push(
      cardFeePayer === 'tenant'
        ? 'Card / Apple Pay payments now include a 2.9% + $0.30 processing fee.'
        : 'Card / Apple Pay payments are now fee-free for you.',
    );
  }
  const body = lines.join(' ');

  // Find all active tenants across this landlord's properties.
  const admin = createServiceRoleClient();
  const { data: properties } = await admin
    .from('properties')
    .select('id')
    .eq('owner_id', user.id);

  const propIds = (properties ?? []).map((p: { id: string }) => p.id);
  if (propIds.length === 0) {
    revalidatePath('/landlord/settings');
    return;
  }

  const { data: leases } = await admin
    .from('leases')
    .select('id')
    .in('property_id', propIds);

  const leaseIds = (leases ?? []).map((l: { id: string }) => l.id);
  if (leaseIds.length === 0) {
    revalidatePath('/landlord/settings');
    return;
  }

  const { data: tenantLinks } = await admin
    .from('lease_tenants')
    .select('user_id')
    .in('lease_id', leaseIds);

  const tenantIds = [...new Set((tenantLinks ?? []).map((t: { user_id: string }) => t.user_id))];

  await Promise.all(
    tenantIds.map(async (tenantId) => {
      await createNotification(admin, tenantId, {
        type: 'venmo_claim_reviewed',
        title: 'Payment fee update',
        body,
        url: '/tenant/pay',
      });
      await sendPushToUser(tenantId, {
        title: 'Payment fee update',
        body,
        url: '/tenant/pay',
        tag: `fee-change-${user.id}-${Date.now()}`,
      });
    }),
  );

  revalidatePath('/landlord/settings');
}

export async function savePaymentHandles(handles: {
  venmo_handle: string;
  cashapp_cashtag: string;
  zelle_handle: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Normalize: strip leading @ / $ and surrounding whitespace; empty → null.
  const clean = (v: string) => {
    const t = v.trim().replace(/^[@$]/, '');
    return t.length > 0 ? t : null;
  };

  const { error } = await supabase
    .from('users')
    .update({
      venmo_handle: clean(handles.venmo_handle),
      cashapp_cashtag: clean(handles.cashapp_cashtag),
      zelle_handle: handles.zelle_handle.trim() || null,
    })
    .eq('id', user.id);
  if (error) throw error;

  revalidatePath('/landlord/settings');
}
