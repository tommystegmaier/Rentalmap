import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { ApplianceForm } from '../_form';
import { deleteAppliance, markApplianceServiced, upsertAppliance } from '../actions';

export default async function EditAppliancePage({
  params,
}: {
  params: { id: string; applianceId: string };
}) {
  const supabase = createClient();
  const [{ data: property }, { data: appliance }] = await Promise.all([
    supabase.from('properties').select('id, address').eq('id', params.id).maybeSingle(),
    supabase
      .from('appliances')
      .select('*')
      .eq('id', params.applianceId)
      .maybeSingle(),
  ]);
  if (!property || !appliance) notFound();

  async function action(formData: FormData) {
    'use server';
    await upsertAppliance(params.id, params.applianceId, formData);
  }

  async function del() {
    'use server';
    await deleteAppliance(params.id, params.applianceId);
  }

  async function markServiced() {
    'use server';
    await markApplianceServiced(params.id, params.applianceId);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={appliance.name} description={property.address} />
      <ApplianceForm
        action={action}
        deleteAction={del}
        markServicedAction={appliance.service_interval_months ? markServiced : undefined}
        initial={{
          name: appliance.name,
          appliance_type: appliance.appliance_type ?? 'general',
          install_date: appliance.install_date,
          warranty_end: appliance.warranty_end,
          serial: appliance.serial,
          model: appliance.model,
          dimensions: appliance.dimensions,
          last_service_date: appliance.last_service_date,
          next_service_due: appliance.next_service_due,
          service_interval_months: appliance.service_interval_months,
          spring_startup_date: appliance.spring_startup_date,
          winterize_date: appliance.winterize_date,
          notes: appliance.notes,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
