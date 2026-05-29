import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { BackButton } from '@/components/back-button';
import { DepreciationForm } from './form';

export default async function DepreciationPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: property } = await supabase
    .from('properties')
    .select(
      'id, address, purchase_price_cents, land_value_cents, placed_in_service, depreciable_basis_cents, annual_depreciation_cents, depreciation_years',
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!property) notFound();

  return (
    <div className="space-y-6">
      <BackButton fallback={`/landlord/properties/${params.id}`} label="Property" />
      <PageHeader
        title="Depreciation calculator"
        description={property.address}
      />
      <DepreciationForm
        propertyId={property.id}
        initial={{
          purchase_price_cents: property.purchase_price_cents ?? null,
          land_value_cents: property.land_value_cents ?? null,
          placed_in_service: property.placed_in_service ?? null,
          depreciation_years: Number(property.depreciation_years ?? 27.5),
        }}
      />
    </div>
  );
}
