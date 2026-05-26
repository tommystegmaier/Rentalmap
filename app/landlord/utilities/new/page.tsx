import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { UtilityBillForm } from './form';

export default async function NewUtilityBillPage({
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
      <PageHeader title="Log utility bill" description="Track a utility bill for a property" />
      <UtilityBillForm properties={propertyList} initialPropertyId={initialPropertyId} />
    </div>
  );
}
