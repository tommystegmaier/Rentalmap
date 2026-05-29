'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseDollarsToCents } from '@/lib/utils';

export async function logRentPayment(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const lease_id = String(formData.get('lease_id'));
  const amount_cents = parseDollarsToCents(String(formData.get('amount') ?? ''));
  const received_date = String(formData.get('received_date'));
  const method = String(formData.get('method')) as
    | 'ach' | 'card' | 'zelle' | 'venmo' | 'cashapp' | 'check' | 'cash' | 'other';
  const notes = (formData.get('notes') as string | null) ?? null;

  if (!lease_id || !amount_cents) throw new Error('Missing required fields');

  const { error } = await supabase.from('rent_payments').insert({
    lease_id,
    expected_date: received_date,
    received_date,
    amount_cents,
    method,
    status: 'manual',
    notes,
    recorded_by: user.id,
  });

  if (error) throw error;
  revalidatePath('/landlord/rent');
  revalidatePath('/landlord');
}
