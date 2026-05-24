import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/utils';

export default async function PayRentPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select('leases:lease_id(monthly_rent_cents, due_day, properties:property_id(address))')
    .eq('user_id', user!.id);

  const rawLease = leaseLinks?.[0]?.leases;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const lease = leaseRow as
    | {
        monthly_rent_cents: number;
        due_day: number;
        properties: { address: string } | { address: string }[] | null;
      }
    | null
    | undefined;
  const propAddr = lease
    ? Array.isArray(lease.properties)
      ? lease.properties[0]?.address
      : lease.properties?.address
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Pay rent" description={propAddr ?? ''} />

      <Card>
        <CardHeader>
          <CardTitle>Amount due</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">
            {lease ? formatCents(lease.monthly_rent_cents) : '—'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Due day {lease?.due_day ?? '—'} of each month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pay with ACH (recommended)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Low fee ($0.80 capped at $5), absorbed by your landlord. Funds settle in 1–3 business
            days.
          </p>
          <Button disabled className="w-full">
            Connect bank account (coming next)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pay with debit / credit card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Card processing fee (2.9% + $0.30) added to your total.
          </p>
          <Button variant="outline" disabled className="w-full">
            Pay with card (coming next)
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Until Stripe is connected, please continue paying via Zelle, Venmo, or check. Your
        landlord will log payments here.
      </p>
    </div>
  );
}
