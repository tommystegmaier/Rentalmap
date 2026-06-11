import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ReceiptText } from 'lucide-react';
import { ExpensePropertyFilter } from '@/components/expense-property-filter';
import { ExpenseSortToggle } from '@/components/expense-sort-toggle';
import { ExpenseSearchFilter } from '@/components/expense-search-filter';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { property_id?: string; sort?: string; q?: string; category?: string };
}) {
  const supabase = createClient();
  const propertyId = searchParams.property_id;
  const sortBy = searchParams.sort === 'expense' ? 'date' : 'created_at';
  const q = searchParams.q?.trim() ?? '';
  const category = searchParams.category ?? '';

  let query = supabase
    .from('expenses')
    .select('id, vendor, category, date, created_at, amount_cents, notes, properties:property_id(address)')
    .order(sortBy, { ascending: false })
    .limit(200);
  if (propertyId) query = query.eq('property_id', propertyId);
  if (category) query = query.eq('category', category);
  if (q) query = query.or(`vendor.ilike.%${q}%,notes.ilike.%${q}%,category.ilike.%${q}%`);

  const [{ data: expenses }, { data: properties }] = await Promise.all([
    query,
    supabase.from('properties').select('id, address').order('created_at'),
  ]);

  const propertyList = (properties ?? []) as { id: string; address: string }[];
  const filterAddress = propertyId
    ? propertyList.find((p) => p.id === propertyId)?.address ?? null
    : null;

  const addUrl = propertyId
    ? `/landlord/expenses/new?property_id=${propertyId}`
    : '/landlord/expenses/new';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description={filterAddress ? `Filtered to ${filterAddress}` : undefined}
        action={
          <Button asChild size="sm">
            <Link href={addUrl}>Add</Link>
          </Button>
        }
      />

      <Link
        href="/landlord/expenses/mortgage/new"
        className="block rounded-lg border bg-muted/30 px-4 py-2.5 text-center text-sm font-medium transition hover:bg-muted/50"
      >
        🏦 Log a mortgage payment
      </Link>

      <div className="space-y-2">
        {propertyList.length > 0 ? (
          <ExpensePropertyFilter properties={propertyList} current={propertyId ?? null} />
        ) : null}
        <ExpenseSearchFilter />
        <ExpenseSortToggle />
      </div>

      {expenses && expenses.length > 0 ? (
        <div className="space-y-2">
          {expenses.map((e: {
            id: string;
            vendor: string | null;
            category: string;
            date: string;
            created_at: string;
            amount_cents: number;
            properties: { address: string } | { address: string }[] | null;
          }) => {
            const propObj = Array.isArray(e.properties) ? e.properties[0] : e.properties;
            const addr = propObj?.address ?? '—';
            const expenseDate = format(parseISO(e.date), 'MMM d, yyyy');
            const entryDate = format(parseISO(e.created_at), 'MMM d, yyyy');
            const datesMatch = e.date === e.created_at.slice(0, 10);
            return (
              <Link key={e.id} href={`/landlord/expenses/${e.id}`}>
                <Card className="transition hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {e.vendor ?? e.category}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.category}{propertyId ? '' : ` · ${addr}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expense date: {expenseDate}
                        {!datesMatch ? (
                          <span className="ml-2 text-muted-foreground/60">
                            · Added {entryDate}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      {formatCents(e.amount_cents)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<ReceiptText size={32} />}
          title={
            filterAddress
              ? `No expenses for ${filterAddress} yet`
              : 'No expenses logged'
          }
          description="Snap a receipt to log your first expense."
          action={
            <Button asChild>
              <Link href={addUrl}>Add expense</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
