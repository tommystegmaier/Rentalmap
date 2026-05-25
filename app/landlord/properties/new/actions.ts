'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseDollarsToCents } from '@/lib/utils';

export async function createProperty(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const address = String(formData.get('address') ?? '').trim();
  if (!address) throw new Error('Address is required');

  const type = String(formData.get('type') ?? 'single_family');
  const purchase_price_cents = parseDollarsToCents(String(formData.get('purchase_price') ?? ''));
  const placed_in_service = (formData.get('placed_in_service') as string) || null;
  const depreciable_basis_cents = parseDollarsToCents(
    String(formData.get('depreciable_basis') ?? ''),
  );
  const annual_depreciation_cents = parseDollarsToCents(
    String(formData.get('annual_depreciation') ?? ''),
  );
  const notes = (formData.get('notes') as string) || null;

  const { data, error } = await supabase
    .from('properties')
    .insert({
      owner_id: user.id,
      address,
      type,
      purchase_price_cents,
      placed_in_service,
      depreciable_basis_cents,
      annual_depreciation_cents,
      notes,
    })
    .select('id')
    .single();

  if (error) throw error;

  // Seed a small set of common appliances so the registry is useful from day one.
  await supabase.from('appliances').insert(
    ['HVAC', 'Water Heater', 'Smoke Detectors', 'CO Detectors', 'Dishwasher', 'Washer', 'Dryer', 'Refrigerator', 'Garage Door Opener'].map(
      (name) => ({ property_id: data.id, name }),
    ),
  );

  revalidatePath('/landlord');
  revalidatePath('/landlord/properties');
  redirect(`/landlord/properties/${data.id}`);
}
