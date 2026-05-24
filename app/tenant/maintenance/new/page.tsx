import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { WorkOrderForm } from './form';

export default async function NewWorkOrderPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select('lease_id, leases:lease_id(property_id)')
    .eq('user_id', user!.id);

  const link = leaseLinks?.[0];
  if (!link) redirect('/tenant');

  const rawLease = link.leases as
    | { property_id: string }
    | { property_id: string }[]
    | null
    | undefined;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const propertyId = leaseRow?.property_id;
  if (!propertyId) redirect('/tenant');

  return (
    <div className="space-y-6">
      <PageHeader
        title="New work order"
        description="Photo, description, urgency — we'll notify the landlord."
      />
      <WorkOrderForm leaseId={link.lease_id} propertyId={propertyId} />
    </div>
  );
}
