'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function landlordSignLease(leaseId: string, name: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Please enter your full name to sign.');

  // Verify the landlord owns the property this lease belongs to
  const { data: lease } = await supabase
    .from('leases')
    .select('id, property_id, properties:property_id(owner_id)')
    .eq('id', leaseId)
    .maybeSingle();

  if (!lease) throw new Error('Lease not found');
  const prop = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;
  if ((prop as { owner_id: string } | null)?.owner_id !== user.id) {
    throw new Error('Not authorized');
  }

  const { error } = await supabase
    .from('leases')
    .update({ landlord_signed_at: new Date().toISOString(), landlord_signed_name: trimmed })
    .eq('id', leaseId);

  if (error) throw error;

  revalidatePath(`/landlord/properties/${lease.property_id}/leases/${leaseId}`);
  revalidatePath(`/landlord/properties/${lease.property_id}`);
}
