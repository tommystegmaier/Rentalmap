'use server';

import { redirect } from 'next/navigation';
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
  const roundTrip = formData.get('round_trip') === 'on';
  const rateRaw = formData.get('rate') as string;
  const purpose = (formData.get('purpose') as string) || null;
  const notes = (formData.get('notes') as string) || null;
  const returnPropertyId = (formData.get('return_property_id') as string) || null;

  if (!propertyId) throw new Error('Property is required');
  if (!tripDate) throw new Error('Trip date is required');

  let miles = parseFloat(milesRaw);
  if (!Number.isFinite(miles) || miles <= 0) throw new Error('Enter a valid mileage');
  if (roundTrip) miles *= 2;
  // Store at one decimal place to match the column precision.
  miles = Math.round(miles * 10) / 10;

  const rate = parseFloat(rateRaw);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Enter a valid rate');

  // Ownership is enforced by RLS, but verify the property belongs to this
  // landlord up front for a clearer error.
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
  if (returnPropertyId) {
    revalidatePath(`/landlord/properties/${returnPropertyId}`);
  }
  redirect('/landlord/mileage');
}
