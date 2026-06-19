'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseDollarsToCents } from '@/lib/utils';

export async function updateRentPayment(id: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const expected_date = String(formData.get('expected_date'));
  const received_date = (formData.get('received_date') as string | null) || null;
  const amount_cents = parseDollarsToCents(String(formData.get('amount') ?? ''));
  const method = String(formData.get('method'));
  const status = String(formData.get('status'));
  const notes = (formData.get('notes') as string | null) || null;

  if (!expected_date || !amount_cents) throw new Error('Missing required fields');

  const { error } = await supabase
    .from('rent_payments')
    .update({ expected_date, received_date, amount_cents, method, status, notes })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/landlord/rent');
  revalidatePath('/landlord');
}
