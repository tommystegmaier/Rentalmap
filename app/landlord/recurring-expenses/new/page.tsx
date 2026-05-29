import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { RecurringExpenseForm } from './form';

export default async function NewRecurringExpensePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: properties } = await supabase
    .from('properties')
    .select('id, address')
    .eq('owner_id', user!.id)
    .order('address');

  return (
    <div className="space-y-6">
      <PageHeader title="New recurring expense" />
      <RecurringExpenseForm properties={properties ?? []} />
    </div>
  );
}
