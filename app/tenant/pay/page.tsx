import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '@/lib/utils';
import { addMonths, format, setDate } from 'date-fns';
import { PayButton } from './pay-button';

export default async function PayRentPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select(
      'lease_id, leases:lease_id(id, monthly_rent_cents, due_day, properties:property_id(address, owner_id))',
    )
    .eq('user_id', user!.id);

  const rawLease = leaseLinks?.[0]?.leases;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const lease = leaseRow as
    | {
        id: string;
        monthly_rent_cents: number;
        due_day: number;
        properties:
          | { address: string; owner_id: string }
          | { address: string; owner_id: string }[]
          | null;
      }
    | null
    | undefined;
  const prop = lease
    ? Array.isArray(lease.properties)
      ? lease.properties[0]
      : lease.properties
    : null;

  // Look up landlord's Stripe connect status (service role — tenant can't read landlord row).
  let landlordConnected = false;
  if (prop) {
    const admin = createServiceRoleClient();
    const { data: landlord } = await admin
      .from('users')
      .select('stripe_connect_account_id')
      .eq('id', prop.owner_id)
      .maybeSingle();
    landlordConnected = !!landlord?.stripe_connect_account_id;
  }

  const today = new Date();
  let nextDue = lease ? setDate(today, lease.due_day) : today;
  if (lease && nextDue < today) nextDue = addMonths(nextDue, 1);
  const expectedDate = format(nextDue, 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      <PageHeader title="Pay rent" description={prop?.address ?? ''} />

      <Card>
        <CardHeader>
          <CardTitle>Amount due</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">
            {lease ? formatCents(lease.monthly_rent_cents) : '—'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Next due {format(nextDue, 'MMMM d, yyyy')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pay securely with Stripe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            You can pay by bank transfer (ACH) or debit/credit card. ACH usually clears in 1–3
            business days; cards clear immediately.
          </p>
          {lease ? (
            <PayButton
              leaseId={lease.id}
              expectedDate={expectedDate}
              landlordConnected={landlordConnected}
            />
          ) : null}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Payments are processed by Stripe. Rentalmap never sees or stores your card or bank
        details.
      </p>
    </div>
  );
}
