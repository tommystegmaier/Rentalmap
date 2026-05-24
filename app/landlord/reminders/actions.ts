'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function dismissReminder(formData: FormData) {
  const id = String(formData.get('id'));
  if (!id) return;
  const supabase = createClient();
  await supabase.from('reminders').update({ dismissed: true }).eq('id', id);
  revalidatePath('/landlord/reminders');
}
