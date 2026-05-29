'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function tenantSignLease(leaseId: string, name: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Please enter your full name to sign.');

  // Verify tenant is linked to this lease
  const { data: link } = await supabase
    .from('lease_tenants')
    .select('id')
    .eq('lease_id', leaseId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!link) throw new Error('You are not listed on this lease.');

  // Verify landlord has already signed
  const { data: lease } = await supabase
    .from('leases')
    .select('landlord_signed_at, tenant_signed_at')
    .eq('id', leaseId)
    .maybeSingle();

  if (!lease?.landlord_signed_at) {
    throw new Error('The landlord must sign first before the tenant can sign.');
  }
  if (lease.tenant_signed_at) {
    throw new Error('This lease has already been signed.');
  }

  const { error } = await supabase
    .from('leases')
    .update({ tenant_signed_at: new Date().toISOString(), tenant_signed_name: trimmed })
    .eq('id', leaseId);

  if (error) throw error;
  revalidatePath('/tenant/lease');
}
