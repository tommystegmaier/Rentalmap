import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { UploadForm } from './form';

export default async function NewDocumentPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('id, address')
    .eq('id', params.id)
    .maybeSingle();
  if (!property) notFound();

  const { data: leases } = await supabase
    .from('leases')
    .select('id, start_date, end_date, status')
    .eq('property_id', params.id)
    .order('start_date', { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title="Upload document" description={property.address} />

      <UploadForm propertyId={params.id} leases={leases ?? []} />

      <Button asChild variant="outline" className="w-full">
        <Link href={`/landlord/properties/${params.id}`}>Cancel</Link>
      </Button>
    </div>
  );
}
