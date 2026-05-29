'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function deleteMileageTrip(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch the linked expense ID before deleting the trip.
  const { data: trip } = await supabase
    .from('mileage_trips')
    .select('expense_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('mileage_trips').delete().eq('id', id);
  if (error) throw error;

  // Delete the linked expense so it doesn't linger on the expenses page.
  if (trip?.expense_id) {
    await supabase.from('expenses').delete().eq('id', trip.expense_id);
  }

  revalidatePath('/landlord/mileage');
  revalidatePath('/landlord/expenses');
  revalidatePath('/landlord/tax');
}
