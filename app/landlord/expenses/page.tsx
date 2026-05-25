import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ReceiptText, X } from 'lucide-react';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { property_id?: string };
}) {
  const supabase = createClient();
  const propertyId = searchParams.property_id;

  let query = supabase
    .from('expenses')
    .select('*, properties:property_id(address)')
    .order('date', { ascending: false })
    .limit(100);
  if (propertyId) query = query.eq('property_id', propertyId);
  const { data: expenses } = await query;

  // When filtered, pull the property address for the header description.
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

      {filterAddress ? (
        <Link
          href="/landlord/expenses"
          className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          <X size={12} /> Clear filter
        </Link>
      ) : null}

      {expenses && expenses.length > 0 ? (
        <div className="space-y-2">
          {expenses.map((e: {
            id: string;
            vendor: string | null;
            category: string;
            date: string;
            amount_cents: number;
            properties: { address: string } | { address: string }[] | null;
          }) => {
            const propObj = Array.isArray(e.properties) ? e.properties[0] : e.properties;
            const addr = propObj?.address ?? '—';
            return (
              <Link key={e.id} href={`/landlord/expenses/${e.id}`}>
                <Card className="transition hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {e.vendor ?? e.category}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.category} · {format(parseISO(e.date), 'MMM d, yyyy')}
                        {propertyId ? '' : ` · ${addr}`}
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
