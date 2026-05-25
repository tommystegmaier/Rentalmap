import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { ApplianceForm } from '../_form';
import { deleteAppliance, upsertAppliance } from '../actions';

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

  return (
    <div className="space-y-6">
      <PageHeader title={appliance.name} description={property.address} />
      <ApplianceForm
        action={action}
        deleteAction={del}
        initial={{
          name: appliance.name,
          install_date: appliance.install_date,
          warranty_end: appliance.warranty_end,
          serial: appliance.serial,
          model: appliance.model,
          last_service_date: appliance.last_service_date,
          next_service_due: appliance.next_service_due,
          notes: appliance.notes,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
