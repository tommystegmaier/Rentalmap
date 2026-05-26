'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseDollarsToCents } from '@/lib/utils';

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

  revalidatePath('/landlord/maintenance');
  revalidatePath(`/landlord/maintenance/${id}`);
  revalidatePath('/tenant/maintenance');
}
