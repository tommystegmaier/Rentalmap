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

  // Outstanding late fees are added to the Venmo amount so the tenant sends
  // everything they owe. They're marked paid when the landlord approves.
  const { data: feeData } = await supabase
    .from('late_fee_charges')
    .select('amount_cents')
    .eq('lease_id', lease.id)
    .eq('waived', false)
    .eq('paid', false);
  const lateFeesCents = (feeData ?? []).reduce(
    (s: number, f: { amount_cents: number }) => s + f.amount_cents,
    0,
  );
  const rentCents = lease.monthly_rent_cents;
  const totalCents = rentCents + lateFeesCents;

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
          <p className="text-2xl font-semibold">{formatCents(totalCents)}</p>
          <p className="text-xs text-muted-foreground">
            For {format(nextDue, 'MMMM yyyy')} · due {format(nextDue, 'MMMM d')}
          </p>
          {lateFeesCents > 0 ? (
            <div className="mt-2 space-y-0.5 border-t pt-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Rent</span>
                <span>{formatCents(rentCents)}</span>
              </div>
              <div className="flex items-center justify-between text-destructive">
                <span>Late fees</span>
                <span>{formatCents(lateFeesCents)}</span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <VenmoClaimForm
        leaseId={lease.id}
        amountCents={totalCents}
        lateFeesCents={lateFeesCents}
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
