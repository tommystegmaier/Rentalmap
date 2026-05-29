'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function saveTaxSchedule(
  enabled: boolean,
  month: number | null,
  day: number | null,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('users')
    .update({
      tax_report_enabled: enabled,
      tax_report_month: enabled ? month : null,
      tax_report_day: enabled ? day : null,
    })
    .eq('id', user.id);
  if (error) throw error;

  revalidatePath('/landlord/tax');
}
