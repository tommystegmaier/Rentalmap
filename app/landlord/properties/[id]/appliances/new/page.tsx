import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { ApplianceForm } from '../_form';
import { upsertAppliance } from '../actions';

export default async function NewAppliancePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('id, address')
    .eq('id', params.id)
    .maybeSingle();
  if (!property) notFound();

  async function action(formData: FormData) {
    'use server';
    await upsertAppliance(params.id, null, formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Add appliance" description={property.address} />
      <ApplianceForm action={action} submitLabel="Add appliance" />
    </div>
  );
}
