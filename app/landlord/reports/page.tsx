import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '@/lib/utils';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

export default async function ReportsPage() {
  const supabase = createClient();
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;

  const [{ data: payments }, { data: expenses }, { data: properties }] = await Promise.all([
    supabase
      .from('rent_payments')
      .select('amount_cents, status, received_date')
      .gte('received_date', yearStart),
    supabase.from('expenses').select('amount_cents, category').gte('date', yearStart),
    supabase.from('properties').select('annual_depreciation_cents'),
  ]);

  const income = (payments ?? [])
    .filter((p: { status: string }) => p.status === 'settled' || p.status === 'manual')
    .reduce((s: number, p: { amount_cents: number }) => s + p.amount_cents, 0);

  const byCategory: Record<string, number> = {};
  for (const c of EXPENSE_CATEGORIES) byCategory[c] = 0;
  for (const e of (expenses ?? []) as { category: string; amount_cents: number }[]) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_cents;
  }
  const depreciation = (properties ?? []).reduce(
    (s: number, p: { annual_depreciation_cents: number | null }) =>
      s + (p.annual_depreciation_cents ?? 0),
    0,
  );
  byCategory.Depreciation = depreciation;

  const totalExpenses = Object.values(byCategory).reduce((s, v) => s + v, 0);
  const net = income - totalExpenses;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description={`Schedule E preview · tax year ${year}`} />

      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="mt-1 text-base font-semibold">{formatCents(income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="mt-1 text-base font-semibold">{formatCents(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Net</p>
            <p
              className={`mt-1 text-base font-semibold ${
                net >= 0 ? 'text-success' : 'text-destructive'
              }`}
            >
              {formatCents(net)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule E by line item</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <table className="w-full">
            <tbody>
              {EXPENSE_CATEGORIES.map((c) => (
                <tr key={c} className="border-b last:border-0">
                  <td className="py-2">{c}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCents(byCategory[c] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Note: this is a preview, not tax advice. Confirm with your accountant before filing.
      </p>
    </div>
  );
}
