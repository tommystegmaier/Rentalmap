import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { mileageRateForYear } from '@/lib/mileage';
import { MileageForm } from './form';

export default async function NewMileagePage({
  searchParams,
}: {
  searchParams: { property_id?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: properties } = await supabase
    .from('properties')
    .select('id, address')
    .eq('owner_id', user.id)
    .order('created_at');

  const propertyList = (properties ?? []) as { id: string; address: string }[];
  if (propertyList.length === 0) redirect('/landlord/properties');

  const today = new Date().toISOString().slice(0, 10);
  const defaultRate = mileageRateForYear(new Date().getFullYear());
  const preselected =
    searchParams.property_id &&
    propertyList.some((p) => p.id === searchParams.property_id)
      ? searchParams.property_id
      : propertyList[0].id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log a trip"
        description="Track deductible miles driven for a rental"
      />
      <MileageForm
        properties={propertyList}
        initialPropertyId={preselected}
        defaultRate={defaultRate}
        today={today}
      />
    </div>
  );
}
