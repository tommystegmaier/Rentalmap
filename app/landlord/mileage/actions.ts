'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function deleteMileageTrip(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('mileage_trips').delete().eq('id', id);
  if (error) throw error;

  revalidatePath('/landlord/mileage');
  revalidatePath('/landlord/tax');
}
