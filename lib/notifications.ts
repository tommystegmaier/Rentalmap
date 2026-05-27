import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType =
  | 'work_order_submitted'
  | 'work_order_in_progress'
  | 'work_order_completed'
  | 'reminder_rent_due'
  | 'reminder_lease_renewal'
  | 'reminder_quarterly_inspection'
  | 'reminder_appliance_service'
  | 'reminder_hvac_filter'
  | 'reminder_custom'
  | 'tenant_rent_due'
  | 'venmo_claim_submitted'
  | 'venmo_claim_reviewed'
  | 'late_fee_applied'
  | 'maintenance_reminder';

export interface NewNotification {
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  related_id?: string;
}

/** Insert a notification row. Safe to call from server actions or API routes. */
export async function createNotification(
  admin: SupabaseClient,
  userId: string,
  n: NewNotification,
) {
  const { error } = await admin.from('notifications').insert({
    user_id: userId,
    type: n.type,
    title: n.title,
    body: n.body,
    url: n.url ?? null,
    related_id: n.related_id ?? null,
  });
  if (error) throw error;
}
