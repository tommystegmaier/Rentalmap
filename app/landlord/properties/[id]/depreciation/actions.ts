'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface SaveDepreciationInput {
  purchase_price_cents: number | null;
  land_value_cents: number | null;
  depreciable_basis_cents: number | null;
  annual_depreciation_cents: number | null;
  placed_in_service: string | null;
  depreciation_years: number;
}

export async function saveDepreciation(propertyId: string, input: SaveDepreciationInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // RLS ensures the landlord can only update their own property.
  const { error } = await supabase
    .from('properties')
    .update({
      purchase_price_cents: input.purchase_price_cents,
      land_value_cents: input.land_value_cents,
      depreciable_basis_cents: input.depreciable_basis_cents,
      annual_depreciation_cents: input.annual_depreciation_cents,
      placed_in_service: input.placed_in_service,
      depreciation_years: input.depreciation_years,
    })
    .eq('id', propertyId);

  if (error) throw error;

  revalidatePath(`/landlord/properties/${propertyId}`);
  revalidatePath(`/landlord/properties/${propertyId}/depreciation`);
  revalidatePath('/landlord/tax');
}
