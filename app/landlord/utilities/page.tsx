import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Zap, Flame, Droplets, Trash2, Wifi, Tv, Package, X } from 'lucide-react';

const UTILITY_TYPE_LABELS: Record<string, string> = {
  electric: 'Electric',
  gas: 'Gas',
  water: 'Water',
  sewer: 'Sewer',
  trash: 'Trash',
  internet: 'Internet',
  cable: 'Cable/TV',
  other: 'Other',
};

function UtilityIcon({ type }: { type: string }) {
  const cls = 'shrink-0 text-muted-foreground';
  switch (type) {
    case 'electric': return <Zap size={16} className={cls} />;
    case 'gas': return <Flame size={16} className={cls} />;
    case 'water':
    case 'sewer': return <Droplets size={16} className={cls} />;
    case 'trash': return <Trash2 size={16} className={cls} />;
    case 'internet': return <Wifi size={16} className={cls} />;
    case 'cable': return <Tv size={16} className={cls} />;
    default: return <Package size={16} className={cls} />;
  }
}

function PaidByBadge({ paidBy }: { paidBy: string }) {
  const colors: Record<string, string> = {
    landlord: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
    tenant: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300',
    shared: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
  };
  const labels: Record<string, string> = {
    landlord: 'Landlord',
    tenant: 'Tenant',
    shared: 'Shared',
  };
  return (
    <Badge className={colors[paidBy] ?? ''}>
      {labels[paidBy] ?? paidBy}
    </Badge>
  );
}

export default async function UtilitiesPage({
  searchParams,
}: {
  searchParams: { property_id?: string };
}) {
  const supabase = createClient();
  const propertyId = searchParams.property_id;

  let query = supabase
    .from('utility_bills')
    .select('*, properties:property_id(address)')
    .order('billing_period_start', { ascending: false })
    .limit(100);
  if (propertyId) query = query.eq('property_id', propertyId);
  const { data: bills } = await query;

  let filterAddress: string | null = null;
  if (propertyId) {
    const { data: prop } = await supabase
      .from('properties')
      .select('address')
      .eq('id', propertyId)
      .maybeSingle();
    filterAddress = prop?.address ?? null;
  }

  const addUrl = propertyId
    ? `/landlord/utilities/new?property_id=${propertyId}`
    : '/landlord/utilities/new';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilities"
        description={filterAddress ? `Filtered to ${filterAddress}` : undefined}
        action={
          <Button asChild size="sm">
            <Link href={addUrl}>Log bill</Link>
          </Button>
        }
      />

      {filterAddress ? (
        <Link
          href="/landlord/utilities"
          className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          <X size={12} /> Clear filter
        </Link>
      ) : null}

      {bills && bills.length > 0 ? (
        <div className="space-y-2">
          {bills.map((b: {
            id: string;
            utility_type: string;
            provider_name: string | null;
            billing_period_start: string | null;
            billing_period_end: string | null;
            amount_cents: number;
            paid_by: string;
            paid_date: string | null;
            properties: { address: string } | { address: string }[] | null;
          }) => {
            const propObj = Array.isArray(b.properties) ? b.properties[0] : b.properties;
            const addr = propObj?.address ?? '—';
            const isPaid = !!b.paid_date;
            return (
              <Link key={b.id} href={`/landlord/utilities/${b.id}`}>
                <Card className="transition hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <UtilityIcon type={b.utility_type} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {UTILITY_TYPE_LABELS[b.utility_type] ?? b.utility_type}
                          {b.provider_name ? ` · ${b.provider_name}` : ''}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {propertyId ? '' : `${addr} · `}
                          {b.billing_period_start
                            ? format(parseISO(b.billing_period_start), 'MMM d')
                            : '—'}
                          {b.billing_period_end
                            ? ` – ${format(parseISO(b.billing_period_end), 'MMM d, yyyy')}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="text-sm font-semibold">{formatCents(b.amount_cents)}</p>
                      <div className="flex items-center gap-1">
                        <PaidByBadge paidBy={b.paid_by} />
                        <Badge
                          className={
                            isPaid
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300'
                          }
                        >
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Zap size={32} />}
          title={filterAddress ? `No utility bills for ${filterAddress} yet` : 'No utility bills logged'}
          description="Track electric, gas, water, and more by logging your first bill."
          action={
            <Button asChild>
              <Link href={addUrl}>Log first bill</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
