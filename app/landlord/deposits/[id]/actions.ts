'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseDollarsToCents } from '@/lib/utils';

export async function updateDeposit(id: string, formData: FormData) {
  const supabase = createClient();

  const status = formData.get('status') as string;
  const returnedDateRaw = (formData.get('returned_date') as string) || null;
  const returnedAmountRaw = (formData.get('returned_amount') as string) || null;
  const holdingInstitution = (formData.get('holding_institution') as string) || null;
  const notes = (formData.get('notes') as string) || null;

  // Parse deduction items from the repeated form fields
  const deductionLabels = formData.getAll('deduction_label') as string[];
  const deductionAmounts = formData.getAll('deduction_amount') as string[];

  const deductionItems: { label: string; amount_cents: number }[] = [];
  for (let i = 0; i < deductionLabels.length; i++) {
    const label = deductionLabels[i]?.trim();
    const amount = parseDollarsToCents(deductionAmounts[i] ?? '');
    if (label && amount && amount > 0) {
      deductionItems.push({ label, amount_cents: amount });
    }
  }

  const returnedAmountCents = returnedAmountRaw
    ? parseDollarsToCents(returnedAmountRaw)
    : null;

  const { error } = await supabase
    .from('security_deposits')
    .update({
      status,
      returned_date: returnedDateRaw || null,
      returned_amount_cents: returnedAmountCents ?? null,
      holding_institution: holdingInstitution,
      notes,
      deduction_items: deductionItems.length > 0 ? deductionItems : null,
    })
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/landlord/deposits');
  revalidatePath(`/landlord/deposits/${id}`);
}
