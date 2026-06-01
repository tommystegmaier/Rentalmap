'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function toggleLateFeeEnabled(leaseId: string, propertyId: string, enabled: boolean) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // RLS ensures only the property owner can update this lease.
  await supabase
    .from('leases')
    .update({ late_fee_enabled: enabled })
    .eq('id', leaseId);

  revalidatePath(`/landlord/properties/${propertyId}`);
}
