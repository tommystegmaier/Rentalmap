import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { WaiveLateFeeButton } from './waive-button';
import { CircleDollarSign } from 'lucide-react';

export default async function LateFeesPage() {
  const supabase = createClient();

  const { data: charges } = await supabase
    .from('late_fee_charges')
    .select(
      'id, charge_date, amount_cents, period_start, reason, waived, waived_at, waive_note, ' +
      'leases:lease_id(monthly_rent_cents, properties:property_id(address))',
    )
    .order('charge_date', { ascending: false })
    .limit(100);

  const rows = (charges ?? []) as unknown as Charge[];
  const active = rows.filter((c) => !c.waived);
  const waived = rows.filter((c) => c.waived);
  const totalOutstanding = active.reduce((s, c) => s + c.amount_cents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Late fees"
        description={
          active.length > 0
            ? `${active.length} outstanding · ${formatCents(totalOutstanding)} total`
            : 'No outstanding late fees'
        }
      />

      {active.length === 0 && waived.length === 0 ? (
        <EmptyState
          icon={<CircleDollarSign size={32} />}
          title="No late fees"
          description="Late fees are auto-applied by the nightly cron when rent is past the grace period. Enable them on a lease to start."
        />
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Outstanding</p>
          {active.map((c) => <LateFeeRow key={c.id} charge={c} />)}
        </div>
      ) : null}

      {waived.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Waived</p>
          {waived.map((c) => <LateFeeRow key={c.id} charge={c} />)}
        </div>
      ) : null}
    </div>
  );
}

function LateFeeRow({ charge }: { charge: Charge }) {
  const lease = Array.isArray(charge.leases) ? charge.leases[0] : charge.leases;
  const prop = lease ? (Array.isArray(lease.properties) ? lease.properties[0] : lease.properties) : null;
  const addr = prop?.address ?? '—';

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{formatCents(charge.amount_cents)}</p>
          <p className="text-xs text-muted-foreground">
            {addr} · period {format(parseISO(charge.period_start), 'MMM yyyy')}
          </p>
          {charge.waive_note ? (
            <p className="text-xs text-muted-foreground">Note: {charge.waive_note}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {charge.waived ? (
            <Badge className="border-transparent bg-muted text-muted-foreground">Waived</Badge>
          ) : (
            <>
              <Badge className="border-transparent bg-destructive/10 text-destructive">Outstanding</Badge>
              <WaiveLateFeeButton id={charge.id} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type Charge = {
  id: string;
  charge_date: string;
  amount_cents: number;
  period_start: string;
  reason: string;
  waived: boolean;
  waived_at: string | null;
  waive_note: string | null;
  leases: { properties: { address: string } | { address: string }[] | null } | { properties: { address: string } | { address: string }[] | null }[] | null;
};
