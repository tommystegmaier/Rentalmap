import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ReceiptText } from 'lucide-react';

export default async function ExpensesPage() {
  const supabase = createClient();
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, properties:property_id(address)')
    .order('date', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        action={
          <Button asChild size="sm">
            <Link href="/landlord/expenses/new">Add</Link>
          </Button>
        }
      />

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
                        {e.category} · {format(parseISO(e.date), 'MMM d, yyyy')} · {addr}
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
          title="No expenses logged"
          description="Snap a receipt to add your first expense."
          action={
            <Button asChild>
              <Link href="/landlord/expenses/new">Add expense</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
