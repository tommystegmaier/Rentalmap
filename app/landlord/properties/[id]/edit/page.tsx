import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { EditPropertyForm } from './form';

export default async function EditPropertyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!property) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit property" description={property.address} />
      <EditPropertyForm
        property={{
          id: property.id,
          address: property.address,
          type: property.type,
          purchase_price_cents: property.purchase_price_cents,
          placed_in_service: property.placed_in_service,
          depreciable_basis_cents: property.depreciable_basis_cents,
          annual_depreciation_cents: property.annual_depreciation_cents,
          asking_rent_cents: property.asking_rent_cents,
          photo_url: property.photo_url,
          notes: property.notes,
        }}
      />
    </div>
  );
}
