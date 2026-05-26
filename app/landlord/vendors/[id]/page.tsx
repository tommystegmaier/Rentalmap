import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { AlertCircle, FileText, Pencil, ReceiptText } from 'lucide-react';

const THRESHOLD_CENTS = 60_000; // $600.00

function maskTaxId(ein: string | null, ssnLast4: string | null): string {
  if (ein) {
    const digits = ein.replace(/\D/g, '');
    if (digits.length >= 4) {
      return `XX-XXX${digits.slice(-4).padStart(4, '0')}`;
    }
    return 'XX-XXXXXXX';
  }
  if (ssnLast4) {
    return `XXX-XX-${ssnLast4}`;
  }
  return '—';
}

export default async function VendorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const currentYear = new Date().getFullYear();
  const priorYear = currentYear - 1;

  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!vendor) notFound();

  // YTD (current year) expenses
  const { data: ytdRows } = await supabase
    .from('expenses')
    .select('amount_cents')
    .eq('vendor_id', params.id)
    .gte('date', `${currentYear}-01-01`)
    .lte('date', `${currentYear}-12-31`);

  const ytdTotal = (ytdRows ?? []).reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0,
  );

  // Prior year expenses
  const { data: priorRows } = await supabase
    .from('expenses')
    .select('amount_cents')
    .eq('vendor_id', params.id)
    .gte('date', `${priorYear}-01-01`)
    .lte('date', `${priorYear}-12-31`);

  const priorTotal = (priorRows ?? []).reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0,
  );

  const needs1099 = ytdTotal >= THRESHOLD_CENTS;
  const priorNeeds1099 = priorTotal >= THRESHOLD_CENTS;

  // All expenses linked to this vendor, newest first
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, date, amount_cents, category, notes')
    .eq('vendor_id', params.id)
    .order('date', { ascending: false })
    .limit(100);

  const v = vendor as {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    ein: string | null;
    ssn_last4: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };

  const addressLine = [v.address, v.city, v.state, v.zip]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={v.name}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/landlord/vendors/${v.id}/edit`}>
              <Pencil size={14} /> Edit
            </Link>
          </Button>
        }
      />

      {needs1099 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            This vendor has been paid {formatCents(ytdTotal)} YTD in {currentYear} — a{' '}
            <strong>1099-NEC is required</strong> (threshold: $600).
          </span>
        </div>
      )}

      {/* Vendor details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendor details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <span className="font-medium text-muted-foreground">Tax ID</span>
            <span>{maskTaxId(v.ein, v.ssn_last4)}</span>

            {addressLine ? (
              <>
                <span className="font-medium text-muted-foreground">Address</span>
                <span>{addressLine}</span>
              </>
            ) : null}

            {v.email ? (
              <>
                <span className="font-medium text-muted-foreground">Email</span>
                <span>{v.email}</span>
              </>
            ) : null}

            {v.phone ? (
              <>
                <span className="font-medium text-muted-foreground">Phone</span>
                <span>{v.phone}</span>
              </>
            ) : null}
          </div>

          {v.notes ? (
            <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              {v.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Payment summary card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">YTD {currentYear}</p>
              <p className="text-xl font-semibold">{formatCents(ytdTotal)}</p>
              {needs1099 ? (
                <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  1099 required
                </Badge>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {formatCents(THRESHOLD_CENTS - ytdTotal)} below $600 threshold
                </p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground">Prior year ({priorYear})</p>
              <p className="text-xl font-semibold">{formatCents(priorTotal)}</p>
              {priorNeeds1099 ? (
                <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  1099 required
                </Badge>
              ) : null}
            </div>
          </div>

          {(needs1099 || priorNeeds1099) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {needs1099 && (
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`/api/vendors/${v.id}/1099?year=${currentYear}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText size={14} />
                    Generate 1099-NEC ({currentYear})
                  </a>
                </Button>
              )}
              {priorNeeds1099 && (
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`/api/vendors/${v.id}/1099?year=${priorYear}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText size={14} />
                    Generate 1099-NEC ({priorYear})
                  </a>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked expenses */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Expenses</h2>

        {expenses && expenses.length > 0 ? (
          <div className="space-y-2">
            {(
              expenses as {
                id: string;
                date: string;
                amount_cents: number;
                category: string;
                notes: string | null;
              }[]
            ).map((e) => (
              <Link key={e.id} href={`/landlord/expenses/${e.id}`}>
                <Card className="transition hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.category}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {format(parseISO(e.date), 'MMM d, yyyy')}
                        {e.notes ? ` · ${e.notes}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      {formatCents(e.amount_cents)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center text-muted-foreground">
            <ReceiptText size={28} />
            <p className="text-sm">No expenses linked to this vendor yet.</p>
            <p className="text-xs">
              When you record an expense, link it to this vendor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
