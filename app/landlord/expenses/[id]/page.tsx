import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { ChevronLeft } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { EditExpenseForm } from './form';

export default async function EditExpensePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: expense } = await supabase
    .from('expenses')
    .select('id, property_id, date, created_at, amount_cents, category, vendor, notes, receipt_url, tax_deductible')
    .eq('id', params.id)
    .maybeSingle();
  if (!expense) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: properties } = await supabase
    .from('properties')
    .select('id, address')
    .eq('owner_id', user!.id)
    .order('created_at');

  let receiptSignedUrl: string | null = null;
  if (expense.receipt_url) {
    const { data: signed } = await supabase.storage
      .from('receipts')
      .createSignedUrl(expense.receipt_url, 60 * 30);
    receiptSignedUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="space-y-6">
      <BackButton fallback="/landlord/expenses" label="Expenses" />
      <PageHeader title="Edit expense" />
      <EditExpenseForm
        expense={expense}
        receiptSignedUrl={receiptSignedUrl}
        properties={(properties ?? []) as { id: string; address: string }[]}
      />
    </div>
  );
}
