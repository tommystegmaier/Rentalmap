'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createVendor(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const isIndividual = formData.get('is_individual') === 'on';

  const { error } = await supabase.from('vendors').insert({
    owner_id: user.id,
    name: formData.get('name') as string,
    address: (formData.get('address') as string) || null,
    city: (formData.get('city') as string) || null,
    state: (formData.get('state') as string) || null,
    zip: (formData.get('zip') as string) || null,
    ein: isIndividual ? null : ((formData.get('ein') as string) || null),
    ssn_last4: isIndividual ? ((formData.get('ssn_last4') as string) || null) : null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    notes: (formData.get('notes') as string) || null,
  });

  if (error) throw error;

  revalidatePath('/landlord/vendors');
  redirect('/landlord/vendors');
}
