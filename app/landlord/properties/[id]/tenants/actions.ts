'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function removeTenantFromLease(
  propertyId: string,
  formData: FormData,
) {
  const leaseTenantId = String(formData.get('lease_tenant_id') ?? '');
  if (!leaseTenantId) return;
  const supabase = createClient();

  // Fetch before deleting so we have lease_id + user_id for cleanup.
  const { data: leaseTenant } = await supabase
    .from('lease_tenants')
    .select('lease_id, user_id')
    .eq('id', leaseTenantId)
    .maybeSingle();

  // RLS gates this: only the property owner can delete the row.
  await supabase.from('lease_tenants').delete().eq('id', leaseTenantId);

  // Also remove the invitation record so it no longer shows in the invite list.
  if (leaseTenant) {
    const admin = createServiceRoleClient();
    const { data: tenantUser } = await admin
      .from('users')
      .select('email')
      .eq('id', leaseTenant.user_id)
      .maybeSingle();

    if (tenantUser?.email) {
      await admin
        .from('tenant_invitations')
        .delete()
        .eq('lease_id', leaseTenant.lease_id)
        .ilike('email', tenantUser.email);
    }
  }

  revalidatePath(`/landlord/properties/${propertyId}`);
  revalidatePath('/landlord/invite');
  revalidatePath('/landlord/messages');
}
