import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { Users, AlertCircle } from 'lucide-react';

const THRESHOLD_CENTS = 60_000; // $600.00

function maskTaxId(ein: string | null, ssnLast4: string | null): string {
  if (ein) {
    // Format: XX-XXXXXXX → show as XX-XXX####
    const digits = ein.replace(/\D/g, '');
    if (digits.length >= 2) {
      return `XX-XXX${digits.slice(-4).padStart(4, '0')}`;
    }
    return 'XX-XXXXXXX';
  }
  if (ssnLast4) {
    return `XXX-XX-${ssnLast4}`;
  }
  return '—';
}

export default async function VendorsPage() {
  const supabase = createClient();

  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name, ein, ssn_last4')
    .order('name');

  // For each vendor, get their YTD total from expenses.
  const vendorIds = (vendors ?? []).map((v) => v.id);
  let ytdByVendor: Record<string, number> = {};

  if (vendorIds.length > 0) {
    const { data: expenseRows } = await supabase
      .from('expenses')
      .select('vendor_id, amount_cents')
      .in('vendor_id', vendorIds)
      .gte('date', yearStart)
      .lte('date', yearEnd);

    for (const row of expenseRows ?? []) {
      if (row.vendor_id) {
        ytdByVendor[row.vendor_id] = (ytdByVendor[row.vendor_id] ?? 0) + (row.amount_cents ?? 0);
      }
    }
  }

  const vendorList = (vendors ?? []) as {
    id: string;
    name: string;
    ein: string | null;
    ssn_last4: string | null;
  }[];

  const needs1099Count = vendorList.filter(
    (v) => (ytdByVendor[v.id] ?? 0) >= THRESHOLD_CENTS,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        action={
          <Button asChild size="sm">
            <Link href="/landlord/vendors/new">Add vendor</Link>
          </Button>
        }
      />

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>
          Vendors paid $600+ this year require a 1099-NEC filing by Jan&nbsp;31.
          {needs1099Count > 0 && (
            <strong> {needs1099Count} vendor{needs1099Count > 1 ? 's' : ''} currently {needs1099Count > 1 ? 'meet' : 'meets'} this threshold.</strong>
          )}
        </span>
      </div>

      {vendorList.length > 0 ? (
        <div className="space-y-2">
          {vendorList.map((v) => {
            const ytd = ytdByVendor[v.id] ?? 0;
            const needs1099 = ytd >= THRESHOLD_CENTS;
            return (
              <Link key={v.id} href={`/landlord/vendors/${v.id}`}>
                <Card className="transition hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{v.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {maskTaxId(v.ein, v.ssn_last4)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCents(ytd)}</p>
                        <p className="text-xs text-muted-foreground">YTD {currentYear}</p>
                      </div>
                      {needs1099 ? (
                        <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          1099
                        </Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Users size={32} />}
          title="No vendors yet"
          description="Add contractors and service providers to track 1099 filing requirements."
          action={
            <Button asChild>
              <Link href="/landlord/vendors/new">Add vendor</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
