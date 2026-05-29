import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/utils';
import { ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export default async function RecurringExpensesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from('recurring_expenses')
    .select(
      'id, amount_cents, category, vendor, frequency, next_due_date, active, properties:property_id(address)',
    )
    .in(
      'property_id',
      (await supabase.from('properties').select('id').eq('owner_id', user!.id)).data?.map(
        (p: { id: string }) => p.id,
      ) ?? [],
    )
    .order('active', { ascending: false })
    .order('next_due_date');

  const active = (rows ?? []).filter((r) => r.active);
  const paused = (rows ?? []).filter((r) => !r.active);

  return (
    <div className="space-y-6">
      <PageHeader title="Recurring expenses" />

      <Button asChild className="w-full">
        <Link href="/landlord/recurring-expenses/new">
          <Plus size={16} /> Add recurring expense
        </Link>
      </Button>

      {rows?.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No recurring expenses yet. Add your mortgage, insurance, HOA dues — they&apos;ll
          auto-post to Expenses each period.
        </p>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map((r) => (
            <RecurringRow key={r.id} r={r} />
          ))}
        </div>
      )}

      {paused.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Paused
          </p>
          {paused.map((r) => (
            <RecurringRow key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecurringRow({ r }: { r: Record<string, unknown> }) {
  const address =
    (Array.isArray(r.properties) ? r.properties[0] : r.properties)?.address ?? '—';
  const label = (r.vendor as string | null) || (r.category as string);
  const nextDue = format(parseISO(r.next_due_date as string), 'MMM d, yyyy');

  return (
    <Card>
      <CardContent className="p-0">
        <Link
          href={`/landlord/recurring-expenses/${r.id}/edit`}
          className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 tap-44"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{address}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw size={10} />
              {FREQ_LABELS[r.frequency as string]} · next {nextDue}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-semibold">{formatCents(r.amount_cents as number)}</p>
              {!(r.active as boolean) && (
                <Badge className="border-transparent bg-muted text-muted-foreground">Paused</Badge>
              )}
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
