'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function deleteProperty(propertyId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // RLS will gate the delete itself, but we read with the user's session to
  // confirm ownership before we start wiping storage.
  const { data: owned } = await supabase
    .from('properties')
    .select('id, owner_id, photo_url')
    .eq('id', propertyId)
    .maybeSingle();
  if (!owned || owned.owner_id !== user.id) {
    throw new Error('Property not found');
  }

  // 1. Cancel any active Stripe auto-pay subscriptions tied to leases on this
  //    property so the tenant doesn't keep getting charged.
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const { getStripe } = await import('@/lib/stripe');
      const stripe = getStripe();

      const { data: subs } = await supabase
        .from('autopay_subscriptions')
        .select('id, stripe_subscription_id, leases:lease_id(property_id)')
        .eq('status', 'active');

      const targets = (subs ?? []).filter((s) => {
        const lease = Array.isArray(s.leases) ? s.leases[0] : s.leases;
        return lease?.property_id === propertyId;
      });

      for (const s of targets) {
        try {
          await stripe.subscriptions.cancel(s.stripe_subscription_id);
        } catch {
          // Best-effort — subscription may already be canceled.
        }
      }
    } catch {
      // If Stripe isn't configured, skip silently.
    }
  }

  // 2. Collect all storage paths owned by this property before we cascade-delete.
  //    We use the service-role client here because work_orders.photo_urls is
  //    awkward to fetch through RLS without all the role policies firing.
  const admin = createServiceRoleClient();

  const [{ data: expenses }, { data: documents }, { data: workOrders }] =
    await Promise.all([
      admin.from('expenses').select('receipt_url').eq('property_id', propertyId),
      admin.from('documents').select('file_url').eq('property_id', propertyId),
      admin.from('work_orders').select('photo_urls').eq('property_id', propertyId),
    ]);

  const receiptPaths = (expenses ?? [])
    .map((e: { receipt_url: string | null }) => e.receipt_url)
    .filter((p: string | null): p is string => !!p);
  const documentPaths = (documents ?? [])
    .map((d: { file_url: string }) => d.file_url)
    .filter(Boolean);
  const workOrderPhotoPaths = (workOrders ?? [])
    .flatMap((w: { photo_urls: string[] | null }) => w.photo_urls ?? [])
    .filter(Boolean);

  // Delete storage files in parallel — each call is independently best-effort.
  await Promise.all([
    owned.photo_url
      ? admin.storage.from('property-photos').remove([owned.photo_url])
      : Promise.resolve(),
    receiptPaths.length > 0
      ? admin.storage.from('receipts').remove(receiptPaths)
      : Promise.resolve(),
    documentPaths.length > 0
      ? admin.storage.from('documents').remove(documentPaths)
      : Promise.resolve(),
    workOrderPhotoPaths.length > 0
      ? admin.storage.from('work-order-photos').remove(workOrderPhotoPaths)
      : Promise.resolve(),
  ]);

  // 3. Delete the property row. ON DELETE CASCADE on all child FKs cleans up
  //    leases, lease_tenants, rent_payments, expenses, work_orders, appliances,
  //    documents, reminders, tenant_invitations, and autopay_subscriptions.
  const { error } = await supabase.from('properties').delete().eq('id', propertyId);
  if (error) throw error;

  revalidatePath('/landlord');
  revalidatePath('/landlord/properties');
  redirect('/landlord/properties');
}
