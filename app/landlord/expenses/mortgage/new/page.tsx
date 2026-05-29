import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { ChevronLeft } from 'lucide-react';
import { MortgageForm } from './form';

export default async function NewMortgagePaymentPage({
  searchParams,
}: {
  searchParams: { property_id?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: properties } = await supabase
    .from('properties')
    .select('id, address')
    .eq('owner_id', user!.id)
    .order('created_at');

  return (
    <div className="space-y-6">
      <Link
        href="/landlord/expenses"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Expenses
      </Link>
      <PageHeader
        title="Mortgage payment"
        description="Record interest, principal, taxes & insurance from your statement"
      />
      <MortgageForm
        properties={(properties ?? []) as { id: string; address: string }[]}
        initialPropertyId={searchParams.property_id}
      />
    </div>
  );
}
