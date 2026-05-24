import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Wallet } from 'lucide-react';

export default async function PaymentsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leaseLinks } = await supabase
    .from('lease_tenants')
    .select('lease_id')
    .eq('user_id', user!.id);
  const leaseIds = leaseLinks?.map((l: { lease_id: string }) => l.lease_id) ?? [];

  const { data: payments } = leaseIds.length
    ? await supabase
        .from('rent_payments')
        .select('*')
        .in('lease_id', leaseIds)
        .order('expected_date', { ascending: false })
    : { data: [] as Array<{
        id: string;
        amount_cents: number;
        status: string;
        method: string | null;
        received_date: string | null;
        expected_date: string;
      }> };

  return (
    <div className="space-y-6">
      <PageHeader title="Payment history" />

      {payments && payments.length > 0 ? (
        <div className="space-y-2">
          {payments.map((p: {
            id: string;
            amount_cents: number;
            status: string;
            method: string | null;
            received_date: string | null;
            expected_date: string;
          }) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium">{formatCents(p.amount_cents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.received_date
                      ? `Received ${format(parseISO(p.received_date), 'PP')}`
                      : `Expected ${format(parseISO(p.expected_date), 'PP')}`}
                    {p.method ? ` · ${p.method}` : ''}
                  </p>
                </div>
                <Badge className="border-transparent bg-secondary">{p.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Wallet size={32} />} title="No payments yet" />
      )}
    </div>
  );
}
