import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO, differenceInCalendarDays, addMonths, setDate } from 'date-fns';
import { Home as HomeIcon } from 'lucide-react';

export default async function TenantDashboard() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select(
      'lease_id, leases:lease_id(*, properties:property_id(address))',
    )
    .eq('user_id', user.id);

  const rawLease = leaseLinks?.[0]?.leases;
  const leaseRow = Array.isArray(rawLease) ? rawLease[0] : rawLease;
  const lease = leaseRow as
    | {
        id: string;
        monthly_rent_cents: number;
        due_day: number;
        start_date: string;
        end_date: string;
        properties: { address: string } | { address: string }[] | null;
      }
    | null
    | undefined;
  const propAddr = lease
    ? Array.isArray(lease.properties)
      ? lease.properties[0]?.address
      : lease.properties?.address
    : null;

  if (!lease) {
    return (
      <div className="space-y-6">
        <PageHeader title="Welcome" />
        <EmptyState
          icon={<HomeIcon size={32} />}
          title="No lease yet"
          description="Your landlord will link your account to a lease after you sign in. If you got an invitation, please make sure you signed up with that email."
        />
      </div>
    );
  }

  const { data: payments } = await supabase
    .from('rent_payments')
    .select('amount_cents, status, received_date, expected_date, method')
    .eq('lease_id', lease.id)
    .order('expected_date', { ascending: false })
    .limit(5);

  const { data: openWorkOrders } = await supabase
    .from('work_orders')
    .select('id, status')
    .eq('submitted_by_user_id', user.id)
    .neq('status', 'closed');

  const today = new Date();
  let nextDue = setDate(today, lease.due_day);
  if (nextDue < today) nextDue = addMonths(nextDue, 1);
  const daysUntil = differenceInCalendarDays(nextDue, today);

  return (
    <div className="space-y-6">
      <PageHeader title="Welcome" description={propAddr ?? ''} />

      <Card>
        <CardHeader>
          <CardTitle>Next rent due</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-semibold">{formatCents(lease.monthly_rent_cents)}</p>
            <p className="text-sm text-muted-foreground">
              {format(nextDue, 'MMM d')} · {daysUntil} day{daysUntil === 1 ? '' : 's'}
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href="/tenant/pay">Pay rent</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lease</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Field
            label="Term"
            value={`${format(parseISO(lease.start_date), 'PP')} → ${format(parseISO(lease.end_date), 'PP')}`}
          />
          <Field label="Due day" value={`${lease.due_day} of month`} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Recent payments</h2>
          <Link href="/tenant/payments" className="text-xs text-primary">
            View all
          </Link>
        </div>
        {payments && payments.length > 0 ? (
          <div className="space-y-2">
            {payments.map((p: {
              amount_cents: number;
              status: string;
              method: string | null;
              received_date: string | null;
              expected_date: string;
            }, i: number) => (
              <Card key={i}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium">{formatCents(p.amount_cents)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.received_date
                        ? `Received ${format(parseISO(p.received_date), 'MMM d')}`
                        : `Expected ${format(parseISO(p.expected_date), 'MMM d')}`}
                      {p.method ? ` · ${p.method}` : ''}
                    </p>
                  </div>
                  <Badge className="border-transparent bg-secondary">{p.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Open work orders</h2>
          <Badge className="border-transparent bg-muted text-muted-foreground">
            {openWorkOrders?.length ?? 0}
          </Badge>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/tenant/maintenance/new">Submit work order</Link>
        </Button>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
