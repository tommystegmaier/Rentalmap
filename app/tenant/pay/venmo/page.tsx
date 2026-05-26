import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { formatCents } from '@/lib/utils';
import { addMonths, format, setDate } from 'date-fns';
import { VenmoClaimForm } from './form';

export default async function VenmoClaimPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select(
      'lease_id, leases:lease_id(id, monthly_rent_cents, due_day, properties:property_id(address))',
    )
    .eq('user_id', user.id);

  const rawLease = leaseLinks?.[0]?.leases;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const lease = leaseRow as {
    id: string;
    monthly_rent_cents: number;
    due_day: number;
    properties: { address: string } | { address: string }[] | null;
  } | null | undefined;

  if (!lease) {
    return (
      <div className="space-y-4">
        <PageHeader title="Log Venmo payment" />
        <p className="text-sm text-muted-foreground">No active lease found.</p>
      </div>
    );
  }

  const prop = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;
  const today = new Date();
  let nextDue = setDate(today, lease.due_day);
  if (nextDue < today) nextDue = addMonths(nextDue, 1);
  const expectedDate = format(nextDue, 'yyyy-MM-dd');

  // Check for existing pending claim for this period
  const { data: existing } = await supabase
    .from('venmo_payment_claims')
    .select('id')
    .eq('lease_id', lease.id)
    .eq('expected_date', expectedDate)
    .eq('status', 'pending')
    .maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader title="Log Venmo payment" description={prop?.address ?? ''} />

      {existing ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
          You already have a pending Venmo claim for {format(nextDue, 'MMMM yyyy')}. Your landlord
          will confirm or deny it shortly.
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-1 p-4 text-sm">
          <p className="font-medium">Amount</p>
          <p className="text-2xl font-semibold">{formatCents(lease.monthly_rent_cents)}</p>
          <p className="text-xs text-muted-foreground">
            For {format(nextDue, 'MMMM yyyy')} · due {format(nextDue, 'MMMM d')}
          </p>
        </CardContent>
      </Card>

      <VenmoClaimForm
        leaseId={lease.id}
        amountCents={lease.monthly_rent_cents}
        expectedDate={expectedDate}
        hasPending={!!existing}
      />

      <p className="text-xs text-muted-foreground">
        Your landlord will receive a notification and confirm or deny the payment. Once approved,
        it will be logged as paid for {format(nextDue, 'MMMM yyyy')}.
      </p>
    </div>
  );
}
