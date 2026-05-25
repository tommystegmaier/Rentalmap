'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function removeTenantFromLease(
  propertyId: string,
  formData: FormData,
) {
  const leaseTenantId = String(formData.get('lease_tenant_id') ?? '');
  if (!leaseTenantId) return;
  const supabase = createClient();
  // RLS gates this: only the property owner can delete the row.
  await supabase.from('lease_tenants').delete().eq('id', leaseTenantId);
  revalidatePath(`/landlord/properties/${propertyId}`);
  revalidatePath('/landlord/messages');
}
