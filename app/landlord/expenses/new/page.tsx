import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { ExpenseForm } from './form';

export default async function NewExpensePage() {
  const supabase = createClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('id, address')
    .order('created_at');

  if (!properties || properties.length === 0) {
    redirect('/landlord/properties');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Add expense" description="Photo a receipt, pick a category" />
      <ExpenseForm
        properties={properties.map((p: { id: string; address: string }) => ({
          id: p.id,
          address: p.address,
        }))}
      />
    </div>
  );
}
