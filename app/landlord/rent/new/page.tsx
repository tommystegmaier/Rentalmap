import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { one } from '@/lib/utils';
import { RentPaymentForm, type LeaseOption } from './form';

export default async function NewRentPaymentPage() {
  const supabase = createClient();
  const { data: leases } = await supabase
    .from('leases')
    .select('id, monthly_rent_cents, properties:property_id(address)')
    .eq('status', 'active');

  if (!leases || leases.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Log rent payment" />
        <p className="text-sm text-muted-foreground">
          No active leases. Add a property and create a lease first.
        </p>
        <Button asChild variant="outline">
          <Link href="/landlord">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const leaseOptions: LeaseOption[] = (leases as Array<{
    id: string;
    monthly_rent_cents: number;
    properties: { address: string } | { address: string }[] | null;
  }>).map((l) => ({
    id: l.id,
    monthly_rent_cents: l.monthly_rent_cents,
    address: one(l.properties)?.address ?? '—',
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log rent payment"
        description="For payments received outside the app"
      />
      <RentPaymentForm leases={leaseOptions} />
    </div>
  );
}
