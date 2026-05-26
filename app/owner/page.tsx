import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { Building2 } from 'lucide-react';
import Link from 'next/link';

export default async function OwnerDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Owner data is fetched via service role — owner RLS only covers property_owners,
  // not the full property/payments tables.
  const admin = createServiceRoleClient();

  const { data: ownerLinks } = await admin
    .from('property_owners')
    .select('property_id, ownership_pct, properties:property_id(id, address, type)')
    .eq('owner_user_id', user!.id);

  const propIds = (ownerLinks ?? []).map((l) => {
    const p = Array.isArray(l.properties) ? l.properties[0] : l.properties;
    return p?.id;
  }).filter(Boolean) as string[];

  // YTD income and expenses per property.
  const year = new Date().getFullYear();
  const ytdStart = `${year}-01-01`;
  const ytdEnd = `${year}-12-31`;

  const [{ data: payments }, { data: expenses }] = await Promise.all([
    propIds.length > 0
      ? admin
          .from('rent_payments')
          .select('amount_cents, leases:lease_id(property_id)')
          .in('status', ['settled', 'manual'])
          .gte('received_date', ytdStart)
          .lte('received_date', ytdEnd)
      : Promise.resolve({ data: [] }),
    propIds.length > 0
      ? admin
          .from('expenses')
          .select('amount_cents, property_id')
          .in('property_id', propIds)
          .gte('date', ytdStart)
          .lte('date', ytdEnd)
      : Promise.resolve({ data: [] }),
  ]);

  // Sum income by property.
  const incomeByProp: Record<string, number> = {};
  for (const p of payments ?? []) {
    const lease = Array.isArray(p.leases) ? p.leases[0] : p.leases as { property_id: string } | null;
    const pid = lease?.property_id;
    if (pid && propIds.includes(pid)) {
      incomeByProp[pid] = (incomeByProp[pid] ?? 0) + (p.amount_cents as number);
    }
  }

  const expenseByProp: Record<string, number> = {};
  for (const e of expenses ?? []) {
    const pid = (e as { property_id: string }).property_id;
    expenseByProp[pid] = (expenseByProp[pid] ?? 0) + (e.amount_cents as number);
  }

  const totalIncome = Object.values(incomeByProp).reduce((s, v) => s + v, 0);
  const totalExpenses = Object.values(expenseByProp).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Owner Dashboard" description={`${year} year-to-date`} />

      {ownerLinks?.length === 0 ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title="No properties linked"
          description="Your property manager hasn't linked any properties to your account yet."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="text-lg font-semibold text-success">{formatCents(totalIncome)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Expenses</p>
                <p className="text-lg font-semibold text-destructive">{formatCents(totalExpenses)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Net</p>
                <p className={`text-lg font-semibold ${totalIncome - totalExpenses >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCents(totalIncome - totalExpenses)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            {(ownerLinks ?? []).map((link) => {
              const prop = Array.isArray(link.properties) ? link.properties[0] : link.properties as { id: string; address: string; type: string } | null;
              if (!prop) return null;
              const income = incomeByProp[prop.id] ?? 0;
              const exp = expenseByProp[prop.id] ?? 0;
              const pct = link.ownership_pct as number;

              return (
                <Link key={prop.id} href={`/owner/properties/${prop.id}`}>
                  <Card className="transition hover:bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{prop.address}</p>
                          <p className="text-xs text-muted-foreground">
                            {prop.type.replace('_', ' ')} · {pct}% ownership
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="text-success">{formatCents(Math.round(income * pct / 100))} income</p>
                          <p className="text-destructive">{formatCents(Math.round(exp * pct / 100))} expenses</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
