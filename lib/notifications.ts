import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType =
  | 'work_order_submitted'
  | 'reminder_rent_due'
  | 'reminder_lease_renewal'
  | 'reminder_quarterly_inspection'
  | 'reminder_appliance_service'
  | 'reminder_hvac_filter'
  | 'reminder_custom'
  | 'tenant_rent_due';

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
  await admin.from('notifications').insert({
    user_id: userId,
    type: n.type,
    title: n.title,
    body: n.body,
    url: n.url ?? null,
    related_id: n.related_id ?? null,
  });
}
