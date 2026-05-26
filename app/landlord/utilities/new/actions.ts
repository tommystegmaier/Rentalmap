'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type UtilityType = 'electric' | 'gas' | 'water' | 'sewer' | 'trash' | 'internet' | 'cable' | 'other';
export type PaidBy = 'landlord' | 'tenant' | 'shared';

export interface CreateUtilityBillInput {
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
  also_log_as_expense: boolean;
}

export async function createUtilityBill(input: CreateUtilityBillInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let expense_id: string | null = null;

  if (input.also_log_as_expense) {
    const { data: expense, error: expErr } = await supabase
      .from('expenses')
      .insert({
        property_id: input.property_id,
        date: input.billing_period_start ?? new Date().toISOString().slice(0, 10),
        amount_cents: input.amount_cents,
        category: 'Utilities',
        vendor: input.provider_name || null,
        notes: input.notes || null,
        receipt_url: null,
        created_by: user.id,
      })
      .select('id')
      .single();
    if (expErr) throw expErr;
    expense_id = expense.id;
  }

  const { error } = await supabase.from('utility_bills').insert({
    property_id: input.property_id,
    utility_type: input.utility_type,
    provider_name: input.provider_name || null,
    account_number: input.account_number || null,
    billing_period_start: input.billing_period_start || null,
    billing_period_end: input.billing_period_end || null,
    amount_cents: input.amount_cents,
    paid_by: input.paid_by,
    due_date: input.due_date || null,
    paid_date: input.paid_date || null,
    notes: input.notes || null,
    expense_id,
    created_by: user.id,
  });
  if (error) throw error;

  revalidatePath('/landlord/utilities');
  revalidatePath('/landlord/expenses');
  redirect('/landlord/utilities');
}
