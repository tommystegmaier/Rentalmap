import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { one } from '@/lib/utils';
import { format } from 'date-fns';
import { nextUnpaidRentPeriod, rentPeriodOptions } from '@/lib/rent-period';
import { RentPaymentForm, type LeaseOption } from './form';

export default async function NewRentPaymentPage() {
  const supabase = createClient();
  const { data: leases } = await supabase
    .from('leases')
    .select('id, monthly_rent_cents, due_day, properties:property_id(address)')
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

  const leaseIds = (leases as Array<{ id: string }>).map((l) => l.id);

  // Fetch all settled/manual payments for active leases in one query.
  const { data: allPaid } = await supabase
    .from('rent_payments')
    .select('lease_id, expected_date')
    .in('lease_id', leaseIds)
    .in('status', ['settled', 'manual']);

  const paidByLease = new Map<string, string[]>();
  for (const p of (allPaid ?? []) as Array<{ lease_id: string; expected_date: string }>) {
    const arr = paidByLease.get(p.lease_id) ?? [];
    arr.push(p.expected_date);
    paidByLease.set(p.lease_id, arr);
  }

  const today = new Date();
  const leaseOptions: LeaseOption[] = (leases as Array<{
    id: string;
    monthly_rent_cents: number;
    due_day: number;
    properties: { address: string } | { address: string }[] | null;
  }>).map((l) => {
    const paid = paidByLease.get(l.id) ?? [];
    const defaultDue = nextUnpaidRentPeriod(l.due_day, paid, today);
    return {
      id: l.id,
      monthly_rent_cents: l.monthly_rent_cents,
      address: one(l.properties)?.address ?? '—',
      defaultExpectedDate: format(defaultDue, 'yyyy-MM-dd'),
      periodOptions: rentPeriodOptions(l.due_day, paid),
    };
  });

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
