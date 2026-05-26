import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3 } from 'lucide-react';

export default async function OwnerFinancialsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createServiceRoleClient();

  const { data: ownerLinks } = await admin
    .from('property_owners')
    .select('property_id, ownership_pct, properties:property_id(id, address)')
    .eq('owner_user_id', user!.id);

  const propIds = (ownerLinks ?? []).map((l) => {
    const p = Array.isArray(l.properties) ? l.properties[0] : l.properties as { id: string } | null;
    return p?.id;
  }).filter(Boolean) as string[];

  if (propIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Financials" />
        <EmptyState icon={<BarChart3 size={32} />} title="No properties linked" description="Contact your property manager." />
      </div>
    );
  }

  // Monthly income for the last 12 months.
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);

  const [{ data: payments }, { data: expenses }] = await Promise.all([
    admin
      .from('rent_payments')
      .select('amount_cents, received_date, leases:lease_id(property_id)')
      .in('status', ['settled', 'manual'])
      .gte('received_date', twelveMonthsAgo),
    admin
      .from('expenses')
      .select('amount_cents, date, category, property_id')
      .in('property_id', propIds)
      .gte('date', twelveMonthsAgo),
  ]);

  // Build monthly summaries.
  const byMonth: Record<string, { income: number; expenses: number }> = {};
  for (const p of payments ?? []) {
    const lease = Array.isArray(p.leases) ? p.leases[0] : p.leases as { property_id: string } | null;
    if (!lease?.property_id || !propIds.includes(lease.property_id)) continue;
    const link = ownerLinks?.find((l) => {
      const pp = Array.isArray(l.properties) ? l.properties[0] : l.properties as { id: string } | null;
      return pp?.id === lease.property_id;
    });
    const pct = (link?.ownership_pct as number ?? 100) / 100;
    const month = (p.received_date as string).slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0 };
    byMonth[month].income += Math.round((p.amount_cents as number) * pct);
  }
  for (const e of expenses ?? []) {
    const link = ownerLinks?.find((l) => {
      const pp = Array.isArray(l.properties) ? l.properties[0] : l.properties as { id: string } | null;
      return pp?.id === (e as { property_id: string }).property_id;
    });
    const pct = (link?.ownership_pct as number ?? 100) / 100;
    const month = (e.date as string).slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0 };
    byMonth[month].expenses += Math.round((e.amount_cents as number) * pct);
  }

  const sortedMonths = Object.keys(byMonth).sort().reverse();
  const totalIncome = sortedMonths.reduce((s, m) => s + byMonth[m].income, 0);
  const totalExpenses = sortedMonths.reduce((s, m) => s + byMonth[m].expenses, 0);

  // Expense breakdown by category.
  const byCategory: Record<string, number> = {};
  for (const e of expenses ?? []) {
    const link = ownerLinks?.find((l) => {
      const pp = Array.isArray(l.properties) ? l.properties[0] : l.properties as { id: string } | null;
      return pp?.id === (e as { property_id: string }).property_id;
    });
    const pct = (link?.ownership_pct as number ?? 100) / 100;
    const cat = e.category as string;
    byCategory[cat] = (byCategory[cat] ?? 0) + Math.round((e.amount_cents as number) * pct);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Financials" description="Last 12 months, prorated by ownership %" />

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Income</p>
          <p className="text-sm font-semibold text-success">{formatCents(totalIncome)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="text-sm font-semibold text-destructive">{formatCents(totalExpenses)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Net</p>
          <p className={`text-sm font-semibold ${totalIncome - totalExpenses >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCents(totalIncome - totalExpenses)}
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Monthly breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {sortedMonths.length === 0 ? (
            <p className="text-muted-foreground">No activity in the last 12 months.</p>
          ) : (
            sortedMonths.map((m) => (
              <div key={m} className="flex justify-between border-b pb-1 last:border-0">
                <span className="text-muted-foreground">{m}</span>
                <div className="flex gap-4">
                  <span className="text-success">{formatCents(byMonth[m].income)}</span>
                  <span className="text-destructive">-{formatCents(byMonth[m].expenses)}</span>
                  <span className="font-medium">{formatCents(byMonth[m].income - byMonth[m].expenses)}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {Object.keys(byCategory).length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Expenses by category</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amt]) => (
                <div key={cat} className="flex justify-between">
                  <span>{cat}</span>
                  <span className="text-destructive">{formatCents(amt)}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
