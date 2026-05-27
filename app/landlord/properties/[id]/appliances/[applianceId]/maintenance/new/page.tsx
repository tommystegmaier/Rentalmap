import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { MaintenanceEventForm } from './form';

export default async function NewMaintenanceEventPage({
  params,
}: {
  params: { id: string; applianceId: string };
}) {
  const supabase = createClient();
  const [{ data: property }, { data: appliance }] = await Promise.all([
    supabase.from('properties').select('id, address').eq('id', params.id).maybeSingle(),
    supabase.from('appliances').select('id, name').eq('id', params.applianceId).maybeSingle(),
  ]);
  if (!property || !appliance) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule maintenance"
        description={`${appliance.name} · ${property.address}`}
      />
      <MaintenanceEventForm
        applianceId={params.applianceId}
        propertyId={params.id}
        applianceName={appliance.name}
      />
    </div>
  );
}
