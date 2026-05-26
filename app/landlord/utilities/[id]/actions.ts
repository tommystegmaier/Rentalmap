'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { UtilityType, PaidBy } from '../new/actions';

export interface UpdateUtilityBillInput {
  id: string;
  property_id: string;
  utility_type: UtilityType;
  provider_name: string | null;
  account_number: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  amount_cents: number;
  paid_by: PaidBy;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
}

export async function updateUtilityBill(input: UpdateUtilityBillInput) {
  const supabase = createClient();
  const { error } = await supabase
    .from('utility_bills')
    .update({
      property_id: input.property_id,
      utility_type: input.utility_type,
      provider_name: input.provider_name,
      account_number: input.account_number,
      billing_period_start: input.billing_period_start,
      billing_period_end: input.billing_period_end,
      amount_cents: input.amount_cents,
      paid_by: input.paid_by,
      due_date: input.due_date,
      paid_date: input.paid_date,
      notes: input.notes,
    })
    .eq('id', input.id);
  if (error) throw error;

  revalidatePath('/landlord/utilities');
  revalidatePath(`/landlord/utilities/${input.id}`);
  revalidatePath('/landlord/expenses');
}

export async function deleteUtilityBill(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('utility_bills').delete().eq('id', id);
  if (error) throw error;

  revalidatePath('/landlord/utilities');
  revalidatePath('/landlord/expenses');
  redirect('/landlord/utilities');
}
