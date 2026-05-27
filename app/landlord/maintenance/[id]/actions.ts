'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { parseDollarsToCents } from '@/lib/utils';
import { createNotification } from '@/lib/notifications';
import { sendPushToUser } from '@/lib/push';

export async function markRelatedNotificationsRead(workOrderId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('related_id', workOrderId)
    .is('read_at', null);
  revalidatePath('/landlord', 'layout');
}

type Status = 'open' | 'in_progress' | 'closed';

export async function updateWorkOrder(id: string, formData: FormData) {
  const supabase = createClient();

  const status = String(formData.get('status') ?? 'open') as Status;
  const vendor_name = (formData.get('vendor_name') as string | null) || null;
  const vendor_phone = (formData.get('vendor_phone') as string | null) || null;
  const totalCost = String(formData.get('total_cost') ?? '');
  const total_cost_cents = totalCost ? parseDollarsToCents(totalCost) : null;
  const landlord_notes_internal =
    (formData.get('landlord_notes_internal') as string | null) || null;
  const landlord_notes_shared =
    (formData.get('landlord_notes_shared') as string | null) || null;

  // Fetch old status + tenant id before update so we can detect transitions
  const { data: oldWo } = await supabase
    .from('work_orders')
    .select('status, submitted_by_user_id, request_type, landlord_notes_shared')
    .eq('id', id)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    status,
    vendor_name,
    vendor_phone,
    total_cost_cents,
    landlord_notes_internal,
    landlord_notes_shared,
  };
  if (status === 'closed') updates.closed_at = new Date().toISOString();

  const { error } = await supabase.from('work_orders').update(updates).eq('id', id);
  if (error) throw error;

  // Notify tenant on status transitions
  const oldStatus = oldWo?.status as Status | undefined;
  const tenantId = oldWo?.submitted_by_user_id as string | null | undefined;
  const reqType = oldWo?.request_type ?? 'Work order';

  if (tenantId && oldStatus && oldStatus !== status) {
    const admin = createServiceRoleClient();
    const url = `/tenant/maintenance/${id}`;

    if (status === 'in_progress') {
      const title = `Work order in progress · ${reqType}`;
      const body = landlord_notes_shared
        ? landlord_notes_shared.slice(0, 120)
        : 'Your landlord has started working on your request.';
      try {
        await createNotification(admin, tenantId, {
          type: 'work_order_in_progress',
          title,
          body,
          url,
          related_id: id,
        });
        await sendPushToUser(tenantId, { title, body, url, tag: `wo-${id}` });
      } catch (err) {
        console.error('[updateWorkOrder] tenant in_progress notify failed:', err);
      }
    } else if (status === 'closed') {
      const title = `Work order completed · ${reqType}`;
      const body = landlord_notes_shared
        ? landlord_notes_shared.slice(0, 120)
        : 'Your landlord has marked your request as completed.';
      try {
        await createNotification(admin, tenantId, {
          type: 'work_order_completed',
          title,
          body,
          url,
          related_id: id,
        });
        await sendPushToUser(tenantId, { title, body, url, tag: `wo-${id}` });
      } catch (err) {
        console.error('[updateWorkOrder] tenant completed notify failed:', err);
      }
    }
  }

  revalidatePath('/landlord/maintenance');
  revalidatePath(`/landlord/maintenance/${id}`);
  revalidatePath('/tenant/maintenance');
}

export async function deleteWorkOrder(id: string) {
  const supabase = createClient();

  // Look up property_id before delete so we can revalidate the right paths
  const { data: wo } = await supabase
    .from('work_orders')
    .select('property_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('work_orders').delete().eq('id', id);
  if (error) throw error;

  revalidatePath('/landlord/maintenance');
  revalidatePath('/tenant/maintenance');
  if (wo?.property_id) {
    revalidatePath(`/landlord/properties/${wo.property_id}`);
    revalidatePath(`/landlord/properties/${wo.property_id}/history`);
  }
}
