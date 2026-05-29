'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Notification types that represent a landlord-driven status change on a work
// order — the only updates the tenant's maintenance badge should reflect.
const STATUS_UPDATE_TYPES = ['work_order_in_progress', 'work_order_completed'];

// Clear every unread work-order status update for the current tenant. Fired
// when they open the Work Orders list, so tapping the maintenance icon clears
// the badge.
export async function markAllWorkOrderUpdatesRead() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .in('type', STATUS_UPDATE_TYPES)
    .is('read_at', null);

  revalidatePath('/tenant');
  revalidatePath('/tenant', 'layout');
}

// Clear unread updates for a single work order, e.g. when the tenant opens it
// directly from a push notification.
export async function markWorkOrderUpdatesRead(workOrderId: string) {
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
    .in('type', STATUS_UPDATE_TYPES)
    .is('read_at', null);

  revalidatePath('/tenant');
  revalidatePath('/tenant', 'layout');
}
