'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function deletePayment(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('rent_payments').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/landlord/rent');
  revalidatePath('/landlord');
}
