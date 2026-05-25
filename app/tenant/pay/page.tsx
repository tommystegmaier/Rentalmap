import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cardChargeCents, formatCents } from '@/lib/utils';
import { addMonths, format, setDate } from 'date-fns';
import { PayButton } from './pay-button';
import { AutopayControls } from './autopay-controls';

export default async function PayRentPage({
  searchParams,
}: {
  searchParams: { autopay?: string };
}) {
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

  let autopay: { id: string; status: string } | null = null;
  if (lease) {
    const { data } = await supabase
      .from('autopay_subscriptions')
      .select('id, status')
      .eq('lease_id', lease.id)
      .eq('tenant_user_id', user!.id)
      .eq('status', 'active')
      .maybeSingle();
    autopay = data as { id: string; status: string } | null;
  }

  const today = new Date();
  let nextDue = lease ? setDate(today, lease.due_day) : today;
  if (lease && nextDue < today) nextDue = addMonths(nextDue, 1);
  const expectedDate = format(nextDue, 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      <PageHeader title="Pay rent" description={prop?.address ?? ''} />

      {searchParams.autopay === 'on' ? (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          Auto-pay is set up. You&apos;ll be charged automatically each month.
        </div>
      ) : null}

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

      {lease ? (
        landlordConnected ? (
          <Card>
            <CardHeader>
              <CardTitle>Pay securely with Stripe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="font-medium">Pay with bank (ACH)</p>
                  <p className="text-lg font-semibold">{formatCents(lease.monthly_rent_cents)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  No fee for you. Settles in 1–3 business days.
                </p>
                <PayButton
                  leaseId={lease.id}
                  expectedDate={expectedDate}
                  method="ach"
                  label={`Pay ${formatCents(lease.monthly_rent_cents)} by bank`}
                />
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <p className="font-medium">Pay with debit / credit card</p>
                  <p className="text-lg font-semibold">
                    {formatCents(cardChargeCents(lease.monthly_rent_cents))}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Includes a 2.9% + $0.30 card processing fee (
                  {formatCents(cardChargeCents(lease.monthly_rent_cents) - lease.monthly_rent_cents)}
                  ). Clears immediately.
                </p>
                <PayButton
                  leaseId={lease.id}
                  expectedDate={expectedDate}
                  method="card"
                  variant="outline"
                  label={`Pay ${formatCents(cardChargeCents(lease.monthly_rent_cents))} by card`}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-sm">
              <p className="text-muted-foreground">
                Your landlord hasn&apos;t finished connecting their bank yet. Please continue
                paying via Zelle, Venmo, or check; payments will be logged here.
              </p>
            </CardContent>
          </Card>
        )
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Auto-pay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Authorize Stripe to charge rent automatically each month. Cancel any time.
          </p>
          {lease ? (
            <AutopayControls
              leaseId={lease.id}
              autopay={autopay}
              landlordConnected={landlordConnected}
            />
          ) : null}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Payments are processed by Stripe. It Rents never sees or stores your card or bank
        details.
      </p>
    </div>
  );
}
