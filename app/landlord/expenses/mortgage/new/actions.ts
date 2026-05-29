'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface MortgageExpenseInput {
  propertyId: string;
  date: string;
  lender: string;
  interestCents: number;
  principalCents: number;
  taxesCents: number;
  insuranceCents: number;
  receiptPath: string | null;
}

// Records a mortgage payment as separate Schedule E expense lines: interest,
// escrowed property taxes and insurance are tax-deductible; principal is
// recorded as non-deductible so it shows in the ledger but not the deduction
// total. All lines share the statement date, lender, and receipt PDF.
export async function createMortgageExpenses(input: MortgageExpenseInput) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (!input.propertyId || !input.date) throw new Error('Missing required fields');

  const base = {
    property_id: input.propertyId,
    date: input.date,
    vendor: input.lender || null,
    receipt_url: input.receiptPath,
    created_by: user.id,
  };

  const rows: Array<Record<string, unknown>> = [];
  if (input.interestCents > 0) {
    rows.push({
      ...base,
      amount_cents: input.interestCents,
      category: 'Mortgage Interest',
      tax_deductible: true,
      notes: 'Mortgage interest',
    });
  }
  if (input.taxesCents > 0) {
    rows.push({
      ...base,
      amount_cents: input.taxesCents,
      category: 'Taxes',
      tax_deductible: true,
      notes: 'Property taxes (escrow)',
    });
  }
  if (input.insuranceCents > 0) {
    rows.push({
      ...base,
      amount_cents: input.insuranceCents,
      category: 'Insurance',
      tax_deductible: true,
      notes: 'Insurance (escrow)',
    });
  }
  if (input.principalCents > 0) {
    rows.push({
      ...base,
      amount_cents: input.principalCents,
      category: 'Other',
      tax_deductible: false,
      notes: 'Mortgage principal (non-deductible)',
    });
  }

  if (rows.length === 0) throw new Error('Enter at least one amount.');

  const { error } = await supabase.from('expenses').insert(rows);
  if (error) throw error;

  revalidatePath('/landlord/expenses');
  revalidatePath('/landlord/tax');
}
