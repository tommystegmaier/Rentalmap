'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function dismissNotification(formData: FormData) {
  const id = String(formData.get('id'));
  if (!id) return;
  const supabase = createClient();
  await supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id);
  revalidatePath('/landlord/notifications');
}

export async function dismissAllNotifications() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('dismissed_at', null);
  revalidatePath('/landlord/notifications');
}
