'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function nonEmpty(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.toString().trim();
  return s ? s : null;
}

export async function upsertAppliance(propertyId: string, applianceId: string | null, formData: FormData) {
  const supabase = createClient();

  const payload = {
    property_id: propertyId,
    name: String(formData.get('name') ?? '').trim(),
    install_date: nonEmpty(formData.get('install_date')),
    warranty_end: nonEmpty(formData.get('warranty_end')),
    serial: nonEmpty(formData.get('serial')),
    model: nonEmpty(formData.get('model')),
    last_service_date: nonEmpty(formData.get('last_service_date')),
    next_service_due: nonEmpty(formData.get('next_service_due')),
    notes: nonEmpty(formData.get('notes')),
  };

  if (!payload.name) throw new Error('Name is required');

  if (applianceId) {
    const { error } = await supabase
      .from('appliances')
      .update(payload)
      .eq('id', applianceId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('appliances').insert(payload);
    if (error) throw error;
  }

  revalidatePath(`/landlord/properties/${propertyId}`);
  redirect(`/landlord/properties/${propertyId}`);
}

export async function deleteAppliance(propertyId: string, applianceId: string) {
  const supabase = createClient();
  await supabase.from('appliances').delete().eq('id', applianceId);
  revalidatePath(`/landlord/properties/${propertyId}`);
  redirect(`/landlord/properties/${propertyId}`);
}
