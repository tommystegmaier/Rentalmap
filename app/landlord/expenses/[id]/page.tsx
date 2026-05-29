import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { ChevronLeft } from 'lucide-react';
import { EditExpenseForm } from './form';

export default async function EditExpensePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: expense } = await supabase
    .from('expenses')
    .select('id, property_id, date, amount_cents, category, vendor, notes, receipt_url')
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
      <Link
        href="/landlord/expenses"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Expenses
      </Link>
      <PageHeader title="Edit expense" />
      <EditExpenseForm
        expense={expense}
        receiptSignedUrl={receiptSignedUrl}
        properties={(properties ?? []) as { id: string; address: string }[]}
      />
    </div>
  );
}
