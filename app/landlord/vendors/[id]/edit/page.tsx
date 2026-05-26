import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { EditVendorForm } from './form';

export default async function EditVendorPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, name, address, city, state, zip, ein, ssn_last4, email, phone, notes')
    .eq('id', params.id)
    .maybeSingle();

  if (!vendor) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit vendor" />
      <EditVendorForm vendor={vendor} />
    </div>
  );
}
