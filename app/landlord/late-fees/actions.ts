'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function waiveLateFee(id: string, note?: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch the property_id so we can revalidate the property detail page.
  const { data: feeRow } = await supabase
    .from('late_fee_charges')
    .select('lease_id, leases:lease_id(property_id)')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('late_fee_charges')
    .update({
      waived: true,
      waived_by: user.id,
      waived_at: new Date().toISOString(),
      waive_note: note?.trim() || null,
    })
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/landlord/late-fees');
  revalidatePath('/landlord/rent');

  // Also revalidate the property detail page so the late fees card updates immediately.
  const lease = feeRow?.leases;
  const propertyId = Array.isArray(lease)
    ? (lease[0] as { property_id?: string } | undefined)?.property_id
    : (lease as unknown as { property_id?: string } | null)?.property_id;
  if (propertyId) {
    revalidatePath(`/landlord/properties/${propertyId}`);
  }
}

/**
 * Mark a late fee as collected. Used to reconcile fees paid outside Stripe
 * (Venmo, cash, check) — Stripe-collected fees are marked paid automatically
 * by the webhook, and P2P-collected fees when the landlord approves the claim.
 */
export async function markLateFeePaid(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: feeRow } = await supabase
    .from('late_fee_charges')
    .select('lease_id, leases:lease_id(property_id)')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('late_fee_charges')
    .update({ paid: true, paid_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/landlord/late-fees');
  revalidatePath('/landlord/rent');

  const lease = feeRow?.leases;
  const propertyId = Array.isArray(lease)
    ? (lease[0] as { property_id?: string } | undefined)?.property_id
    : (lease as unknown as { property_id?: string } | null)?.property_id;
  if (propertyId) {
    revalidatePath(`/landlord/properties/${propertyId}`);
  }
}
