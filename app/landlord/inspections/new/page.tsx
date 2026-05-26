import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { NewInspectionForm } from './form';

interface PropertyWithLease {
  id: string;
  address: string;
  leases: { id: string; start_date: string; end_date: string | null }[];
}

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: { property_id?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawProps } = await supabase
    .from('properties')
    .select('id, address, leases(id, start_date, end_date)')
    .order('address');

  const properties = ((rawProps ?? []) as unknown as PropertyWithLease[]).map((p) => ({
    id: p.id,
    address: p.address,
    leases: Array.isArray(p.leases) ? p.leases : p.leases ? [p.leases] : [],
  }));

  // Pre-select the property if we arrived from a property detail page.
  const initialPropertyId =
    searchParams.property_id && properties.some((p) => p.id === searchParams.property_id)
      ? searchParams.property_id
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New inspection"
        description="Document the property condition room by room."
      />
      <NewInspectionForm properties={properties} initialPropertyId={initialPropertyId} />
    </div>
  );
}
