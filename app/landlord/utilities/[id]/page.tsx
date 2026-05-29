import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { ChevronLeft } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { EditUtilityBillForm } from './form';

export default async function EditUtilityBillPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: bill } = await supabase
    .from('utility_bills')
    .select(
      'id, property_id, utility_type, provider_name, account_number, billing_period_start, billing_period_end, amount_cents, paid_by, due_date, paid_date, notes',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!bill) notFound();

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
      <BackButton fallback="/landlord/utilities" label="Utilities" />
      <PageHeader title="Edit utility bill" />
      <EditUtilityBillForm
        bill={bill}
        properties={(properties ?? []) as { id: string; address: string }[]}
      />
    </div>
  );
}
