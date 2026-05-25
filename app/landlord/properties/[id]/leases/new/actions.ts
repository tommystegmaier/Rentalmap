'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseDollarsToCents } from '@/lib/utils';

export async function createLease(propertyId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const start_date = String(formData.get('start_date'));
  const end_date = String(formData.get('end_date'));
  const monthly_rent_cents = parseDollarsToCents(String(formData.get('monthly_rent') ?? ''));
  if (!start_date || !end_date || !monthly_rent_cents) {
    throw new Error('Start, end, and monthly rent are required');
  }

  const due_day = Math.min(28, Math.max(1, Number(formData.get('due_day') ?? 1)));
  const late_after_day = Math.min(28, Math.max(1, Number(formData.get('late_after_day') ?? 5)));
  const late_fee_cents = parseDollarsToCents(String(formData.get('late_fee') ?? '50')) ?? 5000;
  const security_deposit_cents =
    parseDollarsToCents(String(formData.get('security_deposit') ?? '')) ?? monthly_rent_cents;
  const pets_allowed = formData.get('pets_allowed') === 'on';
  const utilities_paid_by = String(formData.get('utilities_paid_by') ?? 'tenant') as
    | 'tenant'
    | 'landlord'
    | 'shared';
  const lawn_care_by = String(formData.get('lawn_care_by') ?? 'tenant') as
    | 'tenant'
    | 'landlord'
    | 'shared';
  const terms_notes = (formData.get('terms_notes') as string) || null;

  const { error } = await supabase.from('leases').insert({
    property_id: propertyId,
    start_date,
    end_date,
    monthly_rent_cents,
    due_day,
    late_after_day,
    late_fee_cents,
    security_deposit_cents,
    pets_allowed,
    utilities_paid_by,
    lawn_care_by,
    terms_notes,
    status: 'active',
  });

  if (error) throw error;
  revalidatePath('/landlord');
  revalidatePath(`/landlord/properties/${propertyId}`);
  redirect(`/landlord/properties/${propertyId}`);
}
