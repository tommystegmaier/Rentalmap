'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface ExpenseInput {
  propertyId: string;
  amountCents: number;
  category: string;
  vendor: string | null;
  notes: string | null;
  taxDeductible: boolean;
  frequency: 'monthly' | 'quarterly' | 'annually';
  nextDueDate: string;
}

function dayFromDate(dateStr: string) {
  return Math.min(parseInt(dateStr.slice(8, 10), 10), 28);
}

export async function createRecurringExpense(input: ExpenseInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('recurring_expenses').insert({
    property_id: input.propertyId,
    amount_cents: input.amountCents,
    category: input.category,
    vendor: input.vendor,
    notes: input.notes,
    tax_deductible: input.taxDeductible,
    frequency: input.frequency,
    day_of_month: dayFromDate(input.nextDueDate),
    next_due_date: input.nextDueDate,
    created_by: user.id,
  });
  if (error) throw error;
  revalidatePath('/landlord/recurring-expenses');
}

export async function updateRecurringExpense(id: string, input: ExpenseInput) {
  const supabase = createClient();
  const { error } = await supabase
    .from('recurring_expenses')
    .update({
      property_id: input.propertyId,
      amount_cents: input.amountCents,
      category: input.category,
      vendor: input.vendor,
      notes: input.notes,
      tax_deductible: input.taxDeductible,
      frequency: input.frequency,
      day_of_month: dayFromDate(input.nextDueDate),
      next_due_date: input.nextDueDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/landlord/recurring-expenses');
}

export async function deleteRecurringExpense(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/landlord/recurring-expenses');
}

export async function setRecurringExpenseActive(id: string, active: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from('recurring_expenses')
    .update({ active })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/landlord/recurring-expenses');
}
