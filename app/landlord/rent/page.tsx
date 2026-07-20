import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StripeRentSection } from '@/components/stripe-rent-section';
import { VenmoClaimsList, type VenmoClaim } from '@/components/venmo-claims-list';
import { DeletePaymentButton } from '@/components/delete-payment-button';
import { PaymentHandles } from '@/app/landlord/settings/payment-handles';
import { formatCents, one } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Pencil, Wallet } from 'lucide-react';
import { isP2PMethod } from '@/lib/p2p';

export default async function RentPage() {
  const supabase = createClient();

  // Compute current month date range
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const monthLabel = format(now, 'MMMM yyyy');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: payments }, { data: rawClaims }, { data: rawLeases }, { data: handles }] = await Promise.all([
    supabase
      .from('rent_payments')
      .select('*, leases:lease_id(properties:property_id(address))')
      .order('expected_date', { ascending: false })
      .limit(50),
    supabase
      .from('venmo_payment_claims')
      .select(
        'id, amount_cents, late_fees_cents, expected_date, method, venmo_note, submitted_at, tenant:tenant_user_id(name, email), lease:lease_id(properties:property_id(address))',
      )
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('leases')
      .select(
        'id, monthly_rent_cents, due_day, late_after_day, property_id, properties:property_id(address), lease_tenants(users:user_id(name))',
      )
      .eq('status', 'active')
      .order('created_at'),
    user
      ? supabase
          .from('users')
          .select('venmo_handle, cashapp_cashtag, zelle_handle')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const activeLeases = (rawLeases ?? []) as {
    id: string;
    monthly_rent_cents: number;
    due_day: number;
    late_after_day: number;
    property_id: string;
    properties: { address: string } | { address: string }[] | null;
    lease_tenants: { users: { name: string | null } | { name: string | null }[] | null }[] | null;
  }[];

  const todayDayOfMonth = now.getDate();

  // Fetch this month's payments for active leases
  let paidLeaseIds = new Set<string>();
  if (activeLeases.length > 0) {
    const { data: thisMonthPayments } = await supabase
      .from('rent_payments')
      .select('lease_id, status')
      .in('lease_id', activeLeases.map((l) => l.id))
      .gte('expected_date', monthStart)
      .lte('expected_date', monthEnd);

    paidLeaseIds = new Set(
      (thisMonthPayments ?? [])
        .filter((p) => p.status === 'settled' || p.status === 'manual')
        .map((p) => p.lease_id),
    );
  }

  const paidCount = activeLeases.filter((l) => paidLeaseIds.has(l.id)).length;

  const pendingClaims: VenmoClaim[] = (rawClaims ?? []).map((c: {
    id: string;
    amount_cents: number;
    late_fees_cents: number | null;
    expected_date: string;
    method: string | null;
    venmo_note: string | null;
    submitted_at: string;
    tenant: { name: string | null; email: string } | { name: string | null; email: string }[] | null;
    lease: { properties: { address: string } | { address: string }[] | null } | { properties: { address: string } | { address: string }[] | null }[] | null;
  }) => {
    const t = Array.isArray(c.tenant) ? c.tenant[0] : c.tenant;
    const l = Array.isArray(c.lease) ? c.lease[0] : c.lease;
    const p = l ? (Array.isArray(l.properties) ? l.properties[0] : l.properties) : null;
    return {
      id: c.id,
      amount_cents: c.amount_cents,
      late_fees_cents: c.late_fees_cents ?? 0,
      expected_date: c.expected_date,
      method: isP2PMethod(c.method) ? c.method : 'venmo',
      venmo_note: c.venmo_note,
      submitted_at: c.submitted_at,
      tenant_name: t?.name ?? null,
      tenant_email: t?.email ?? null,
      property_address: p?.address ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent"
        description="Payments across all properties"
        action={
          <Button asChild size="sm">
            <Link href="/landlord/rent/new">Log payment</Link>
          </Button>
        }
      />

      <StripeRentSection />

      {/* This-month rent status summary */}
      {activeLeases.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {monthLabel} · {paidCount} of {activeLeases.length} paid
          </p>
          {activeLeases.map((lease) => {
            const addr = one(lease.properties)?.address ?? '—';
            const firstTenant = lease.lease_tenants?.[0];
            const tenantName = firstTenant
              ? one(firstTenant.users)?.name ?? null
              : null;
            const paid = paidLeaseIds.has(lease.id);
            const isLate = !paid && todayDayOfMonth > lease.late_after_day;
            return (
              <Card key={lease.id}>
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{addr}</p>
                    <p className="text-xs text-muted-foreground">
                      {tenantName ?? 'No tenant'} · {formatCents(lease.monthly_rent_cents)}/mo
                      {lease.due_day ? ` · due ${lease.due_day}th` : ''}
                    </p>
                  </div>
                  <Badge
                    className={
                      paid
                        ? 'shrink-0 border-transparent bg-success/10 text-success'
                        : isLate
                          ? 'shrink-0 border-transparent bg-destructive/10 text-destructive'
                          : 'shrink-0 border-transparent bg-muted text-muted-foreground'
                    }
                  >
                    {paid ? 'Paid' : isLate ? 'Late' : 'Unpaid'}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">P2P payment handles</p>
          <p className="text-xs text-muted-foreground">
            Set your Venmo, Cash App, and Zelle usernames so tenants can send you rent directly.
          </p>
          <PaymentHandles
            initialVenmo={handles?.venmo_handle ?? ''}
            initialCashapp={handles?.cashapp_cashtag ?? ''}
            initialZelle={handles?.zelle_handle ?? ''}
          />
        </CardContent>
      </Card>

      {pendingClaims.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Pending payment claims</p>
          <VenmoClaimsList claims={pendingClaims} />
        </div>
      ) : null}

      {payments && payments.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Payment history</p>
          {payments.map((p: {
            id: string;
            amount_cents: number;
            status: string;
            method: string | null;
            received_date: string | null;
            expected_date: string;
            leases:
              | { properties: { address: string } | { address: string }[] | null }
              | { properties: { address: string } | { address: string }[] | null }[]
              | null;
          }) => {
            const leaseObj = Array.isArray(p.leases) ? p.leases[0] : p.leases;
            const propObj = leaseObj
              ? Array.isArray(leaseObj.properties)
                ? leaseObj.properties[0]
                : leaseObj.properties
              : null;
            const addr = propObj?.address;
            return (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{formatCents(p.amount_cents)}</p>
                    <p className="text-xs text-muted-foreground">
                      {addr ?? '—'} · expected{' '}
                      {format(parseISO(p.expected_date), 'MMM d, yyyy')}
                    </p>
                    {p.received_date ? (
                      <p className="text-xs text-muted-foreground">
                        Received {format(parseISO(p.received_date), 'MMM d, yyyy')}
                        {p.method ? ` · ${p.method}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={p.status} />
                    <Link
                      href={`/landlord/rent/${p.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted/50"
                      aria-label="Edit payment"
                    >
                      <Pencil size={13} />
                    </Link>
                    <a
                      href={`/api/payments/${p.id}/receipt`}
                      className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                      PDF
                    </a>
                    <DeletePaymentButton id={p.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Wallet size={32} />}
          title="No payments yet"
          description="Log your first rent payment to start the ledger."
          action={
            <Button asChild>
              <Link href="/landlord/rent/new">Log payment</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    settled: 'bg-success/10 text-success border-transparent',
    manual: 'bg-success/10 text-success border-transparent',
    pending: 'bg-warning/10 text-warning border-transparent',
    failed: 'bg-destructive/10 text-destructive border-transparent',
  };
  return <Badge className={styles[status] ?? ''}>{status}</Badge>;
}
