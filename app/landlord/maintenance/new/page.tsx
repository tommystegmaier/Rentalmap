import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { LandlordWorkOrderForm } from './form';

export default async function NewLandlordWorkOrderPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: properties } = await supabase
    .from('properties')
    .select('id, address, leases(id, status)')
    .eq('owner_id', user.id);

  if (!properties || properties.length === 0) {
    redirect('/landlord/properties');
  }

  const mapped = properties.map(
    (p: { id: string; address: string; leases: { id: string; status: string }[] }) => ({
      id: p.id,
      address: p.address,
      active_lease_id:
        (p.leases ?? []).find((l) => l.status === 'active')?.id ?? null,
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="New work order"
        description="Log a repair you're handling yourself or a vendor visit you scheduled."
      />
      <LandlordWorkOrderForm properties={mapped} />
    </div>
  );
}
