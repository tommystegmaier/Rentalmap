import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents, one } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Landmark } from 'lucide-react';

type DepositStatus =
  | 'holding'
  | 'returned'
  | 'partially_returned'
  | 'applied_to_damages'
  | 'forfeited';

function statusBadgeClass(status: DepositStatus): string {
  switch (status) {
    case 'holding':
      return 'border-blue-300 bg-blue-50 text-blue-700';
    case 'returned':
      return 'border-green-300 bg-green-50 text-green-700';
    case 'partially_returned':
      return 'border-yellow-300 bg-yellow-50 text-yellow-700';
    case 'applied_to_damages':
      return 'border-red-300 bg-red-50 text-red-700';
    case 'forfeited':
      return 'border-red-300 bg-red-50 text-red-700';
    default:
      return 'border-muted bg-muted/30 text-muted-foreground';
  }
}

function statusLabel(status: DepositStatus): string {
  switch (status) {
    case 'holding':
      return 'Holding';
    case 'returned':
      return 'Returned';
    case 'partially_returned':
      return 'Partial return';
    case 'applied_to_damages':
      return 'Applied to damages';
    case 'forfeited':
      return 'Forfeited';
    default:
      return status;
  }
}

interface DepositRow {
  id: string;
  amount_cents: number;
  received_date: string | null;
  status: DepositStatus;
  interest_accrued_cents: number;
  leases:
    | {
        start_date: string;
        end_date: string;
        monthly_rent_cents: number;
        properties: { address: string } | { address: string }[] | null;
      }
    | {
        start_date: string;
        end_date: string;
        monthly_rent_cents: number;
        properties: { address: string } | { address: string }[] | null;
      }[]
    | null;
}

export default async function SecurityDepositsPage() {
  const supabase = createClient();

  const { data: deposits } = await supabase
    .from('security_deposits')
    .select(
      'id, amount_cents, received_date, status, interest_accrued_cents, leases:lease_id(start_date, end_date, monthly_rent_cents, properties:property_id(address))',
    )
    .order('received_date', { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Deposits"
        action={
          <Button asChild size="sm">
            <Link href="/landlord/deposits/new">Record deposit</Link>
          </Button>
        }
      />

      {deposits && deposits.length > 0 ? (
        <div className="space-y-2">
          {(deposits as DepositRow[]).map((d) => {
            const lease = one(d.leases);
            const property = lease ? one(lease.properties) : null;
            const address = property?.address ?? '—';

            return (
              <Link key={d.id} href={`/landlord/deposits/${d.id}`}>
                <Card className="transition hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{address}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.received_date
                          ? `Received ${format(parseISO(d.received_date), 'MMM d, yyyy')}`
                          : 'Date not recorded'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="text-sm font-semibold">
                        {formatCents(d.amount_cents)}
                      </p>
                      <Badge className={statusBadgeClass(d.status)}>
                        {statusLabel(d.status)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Landmark size={32} />}
          title="No security deposits recorded"
          description="Add one from a lease or record a deposit directly."
          action={
            <Button asChild>
              <Link href="/landlord/deposits/new">Record deposit</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
