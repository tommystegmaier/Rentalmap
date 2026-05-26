import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StripeRentSection } from '@/components/stripe-rent-section';
import { VenmoClaimsList, type VenmoClaim } from '@/components/venmo-claims-list';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Wallet } from 'lucide-react';

export default async function RentPage() {
  const supabase = createClient();
  const [{ data: payments }, { data: rawClaims }] = await Promise.all([
    supabase
      .from('rent_payments')
      .select('*, leases:lease_id(properties:property_id(address))')
      .order('expected_date', { ascending: false })
      .limit(50),
    supabase
      .from('venmo_payment_claims')
      .select(
        'id, amount_cents, expected_date, venmo_note, submitted_at, tenant:tenant_user_id(name, email), lease:lease_id(properties:property_id(address))',
      )
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false }),
  ]);

  const pendingClaims: VenmoClaim[] = (rawClaims ?? []).map((c: {
    id: string;
    amount_cents: number;
    expected_date: string;
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
      expected_date: c.expected_date,
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

      {pendingClaims.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Pending Venmo claims</p>
          <VenmoClaimsList claims={pendingClaims} />
        </div>
      ) : null}

      {payments && payments.length > 0 ? (
        <div className="space-y-2">
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
                    <a
                      href={`/api/payments/${p.id}/receipt`}
                      className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                      PDF
                    </a>
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
