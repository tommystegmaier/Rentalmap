import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { ExpenseForm } from './form';

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: { property_id?: string };
}) {
  const supabase = createClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('id, address')
    .order('created_at');

  if (!properties || properties.length === 0) {
    redirect('/landlord/properties');
  }

  const propertyList = properties.map((p: { id: string; address: string }) => ({
    id: p.id,
    address: p.address,
  }));

  const initialPropertyId =
    searchParams.property_id &&
    propertyList.some((p) => p.id === searchParams.property_id)
      ? searchParams.property_id
      : propertyList[0].id;

  return (
    <div className="space-y-6">
      <PageHeader title="Add expense" description="Photo a receipt, pick a category" />
      <ExpenseForm properties={propertyList} initialPropertyId={initialPropertyId} />
    </div>
  );
}
