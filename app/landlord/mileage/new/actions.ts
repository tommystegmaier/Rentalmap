'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createMileageTrip(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const propertyId = formData.get('property_id') as string;
  const tripDate = (formData.get('trip_date') as string) || null;
  const milesRaw = formData.get('miles') as string;
  const rateRaw = formData.get('rate') as string;
  const purpose = (formData.get('purpose') as string) || null;
  const notes = (formData.get('notes') as string) || null;

  if (!propertyId) throw new Error('Property is required');
  if (!tripDate) throw new Error('Trip date is required');

  const miles = Math.round(parseFloat(milesRaw) * 10) / 10;
  if (!Number.isFinite(miles) || miles <= 0) throw new Error('Enter a valid mileage');

  const rate = parseFloat(rateRaw);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Enter a valid rate');

  const { data: prop } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .maybeSingle();
  if (!prop) throw new Error('Property not found');

  const { error } = await supabase.from('mileage_trips').insert({
    owner_id: user.id,
    property_id: propertyId,
    trip_date: tripDate,
    miles,
    rate_cents: rate,
    purpose,
    notes,
  });
  if (error) throw error;

  revalidatePath('/landlord/mileage');
  revalidatePath('/landlord/tax');
}
