'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function saveFeePayerSettings(
  achFeePayer: 'landlord' | 'tenant',
  cardFeePayer: 'landlord' | 'tenant',
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('users')
    .update({ ach_fee_payer: achFeePayer, card_fee_payer: cardFeePayer })
    .eq('id', user.id);
  if (error) throw error;
  revalidatePath('/landlord/settings');
}
