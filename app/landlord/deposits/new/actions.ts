'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseDollarsToCents } from '@/lib/utils';

export async function createDeposit(formData: FormData) {
  const supabase = createClient();

  const leaseId = formData.get('lease_id') as string;
  const amountRaw = formData.get('amount') as string;
  const receivedDate = (formData.get('received_date') as string) || null;
  const holdingInstitution = (formData.get('holding_institution') as string) || null;
  const interestRateRaw = formData.get('interest_rate_pct') as string;
  const notes = (formData.get('notes') as string) || null;

  const amountCents = parseDollarsToCents(amountRaw);
  if (!amountCents || amountCents <= 0) {
    throw new Error('Invalid amount');
  }

  const interestRate = parseFloat(interestRateRaw ?? '0');
  const interestRatePct = Number.isFinite(interestRate) ? interestRate : 0;

  const { error } = await supabase.from('security_deposits').insert({
    lease_id: leaseId,
    amount_cents: amountCents,
    received_date: receivedDate || null,
    holding_institution: holdingInstitution,
    interest_rate_pct: interestRatePct,
    notes,
    status: 'holding',
  });

  if (error) throw error;

  revalidatePath('/landlord/deposits');
  redirect('/landlord/deposits');
}
