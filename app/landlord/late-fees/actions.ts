'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function waiveLateFee(id: string, note?: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('late_fee_charges')
    .update({
      waived: true,
      waived_by: user.id,
      waived_at: new Date().toISOString(),
      waive_note: note?.trim() || null,
    })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/landlord/late-fees');
  revalidatePath('/landlord/rent');
}
