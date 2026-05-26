import { notFound } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export default async function OwnerPropertyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createServiceRoleClient();

  // Verify this owner has access to this property.
  const { data: link } = await admin
    .from('property_owners')
    .select('ownership_pct')
    .eq('property_id', params.id)
    .eq('owner_user_id', user!.id)
    .maybeSingle();
  if (!link) notFound();

  const { data: prop } = await admin
    .from('properties')
    .select('id, address, type')
    .eq('id', params.id)
    .maybeSingle();
  if (!prop) notFound();

  const year = new Date().getFullYear();
  const ytdStart = `${year}-01-01`;
  const ytdEnd = `${year}-12-31`;

  const [{ data: payments }, { data: expenses }, { data: activeLeases }] = await Promise.all([
    admin
      .from('rent_payments')
      .select('id, amount_cents, received_date, expected_date, method, status, leases:lease_id(id)')
      .in('status', ['settled', 'manual'])
      .gte('received_date', ytdStart)
      .lte('received_date', ytdEnd)
      .order('received_date', { ascending: false }),
    admin
      .from('expenses')
      .select('id, date, amount_cents, category, vendor, notes')
      .eq('property_id', params.id)
      .gte('date', ytdStart)
      .lte('date', ytdEnd)
      .order('date', { ascending: false }),
    admin
      .from('leases')
      .select('id, monthly_rent_cents, start_date, end_date, status')
      .eq('property_id', params.id)
      .eq('status', 'active'),
  ]);

  // Filter payments to this property's leases.
  const leaseIds = new Set((activeLeases ?? []).map((l: { id: string }) => l.id));
  const propPayments = (payments ?? []).filter((p) => {
    const lid = Array.isArray(p.leases) ? p.leases[0]?.id : (p.leases as { id: string } | null)?.id;
    return lid && leaseIds.has(lid);
  });

  const totalIncome = propPayments.reduce((s, p) => s + (p.amount_cents as number), 0);
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + (e.amount_cents as number), 0);
  const pct = link.ownership_pct as number;

  return (
    <div className="space-y-6">
      <PageHeader title={prop.address} description={`${pct}% ownership · ${year} YTD`} />

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-sm font-semibold text-success">{formatCents(Math.round(totalIncome * pct / 100))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-sm font-semibold text-destructive">{formatCents(Math.round(totalExpenses * pct / 100))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Net</p>
            <p className={`text-sm font-semibold ${totalIncome - totalExpenses >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCents(Math.round((totalIncome - totalExpenses) * pct / 100))}
            </p>
          </CardContent>
        </Card>
      </div>

      {propPayments.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Rent payments</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {propPayments.map((p) => (
              <div key={p.id as string} className="flex justify-between">
                <div>
                  <span>{format(parseISO(p.received_date as string), 'MMM d, yyyy')}</span>
                  {p.method ? <span className="ml-2 text-muted-foreground">{p.method as string}</span> : null}
                </div>
                <span className="font-medium">{formatCents(p.amount_cents as number)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {(expenses ?? []).length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(expenses ?? []).map((e) => (
              <div key={e.id as string} className="flex justify-between">
                <div>
                  <span>{e.category as string}</span>
                  {e.vendor ? <span className="ml-2 text-muted-foreground">{e.vendor as string}</span> : null}
                  <span className="ml-2 text-muted-foreground">{format(parseISO(e.date as string), 'MMM d')}</span>
                </div>
                <span className="font-medium text-destructive">{formatCents(e.amount_cents as number)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {(activeLeases ?? []).length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Active leases</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(activeLeases ?? []).map((l: { id: string; monthly_rent_cents: number; start_date: string; end_date: string; status: string }) => (
              <div key={l.id} className="flex justify-between">
                <span>{format(parseISO(l.start_date), 'MMM yyyy')} – {format(parseISO(l.end_date), 'MMM yyyy')}</span>
                <div className="flex items-center gap-2">
                  <Badge className="border-transparent bg-success/10 text-success">{l.status}</Badge>
                  <span className="font-medium">{formatCents(l.monthly_rent_cents)}/mo</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
