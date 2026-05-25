'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

interface UpdateExpenseInput {
  id: string;
  property_id: string;
  date: string;
  amount_cents: number;
  category: string;
  vendor: string | null;
  notes: string | null;
  receipt_url: string | null;
}

export async function updateExpense(input: UpdateExpenseInput) {
  const supabase = createClient();
  const { error } = await supabase
    .from('expenses')
    .update({
      property_id: input.property_id,
      date: input.date,
      amount_cents: input.amount_cents,
      category: input.category,
      vendor: input.vendor,
      notes: input.notes,
      receipt_url: input.receipt_url,
    })
    .eq('id', input.id);
  if (error) throw error;
  revalidatePath('/landlord/expenses');
  revalidatePath(`/landlord/expenses/${input.id}`);
  revalidatePath('/landlord');
}

export async function deleteExpense(id: string) {
  const supabase = createClient();

  // Fetch the receipt path so we can clean it out of storage too.
  const { data: existing } = await supabase
    .from('expenses')
    .select('receipt_url')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;

  if (existing?.receipt_url) {
    await supabase.storage.from('receipts').remove([existing.receipt_url]);
  }

  revalidatePath('/landlord/expenses');
  revalidatePath('/landlord');
  redirect('/landlord/expenses');
}
