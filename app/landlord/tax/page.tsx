import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '@/lib/utils';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { computeTaxReportData } from '@/lib/tax-report-data';
import { format, parseISO } from 'date-fns';
import { FileText, Download, Car, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import {
  TaxYearPicker,
  TaxPropertyPicker,
  TaxScheduleSettings,
  DeleteTaxReportButton,
  GenerateReportButton,
} from './controls';

export default async function TaxCenterPage({
  searchParams,
}: {
  searchParams: { year?: string; generated?: string; property_id?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const currentYear = new Date().getFullYear();
  const year = Number(searchParams.year ?? currentYear) || currentYear;
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const propertyId = searchParams.property_id || null;

  const [{ data: profile }, data, { data: reports }, { data: propertyList }] =
    await Promise.all([
      supabase
        .from('users')
        .select('tax_report_enabled, tax_report_month, tax_report_day')
        .eq('id', user.id)
        .maybeSingle(),
      computeTaxReportData(supabase, user.id, year, propertyId),
      supabase
        .from('tax_reports')
        .select('id, year, generated_at, generated_by, net_cents, property_label')
        .eq('owner_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(12),
      supabase
        .from('properties')
        .select('id, address')
        .eq('owner_id', user.id)
        .order('created_at'),
    ]);

  const properties = (propertyList ?? []) as { id: string; address: string }[];
  const selectedAddress = propertyId
    ? properties.find((p) => p.id === propertyId)?.address ?? null
    : null;
  const generateUrl = `/api/tax-report?year=${year}${
    propertyId ? `&property_id=${propertyId}` : ''
  }`;

  const categoryTotals: Record<string, number> = {};
  for (const c of EXPENSE_CATEGORIES) categoryTotals[c] = 0;
  for (const p of data.properties) {
    for (const c of EXPENSE_CATEGORIES) categoryTotals[c] += p.byCategory[c] ?? 0;
  }
  categoryTotals.Depreciation = data.totalDepreciationCents;

  return (
    <div className="space-y-6">
      <PageHeader title="Tax Center" description="Profit & loss and deductible totals by year" />

      {searchParams.generated === '1' ? (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          Report generated and saved below. Tap it to view or download.
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-sm text-muted-foreground">Tax year</span>
          <TaxYearPicker year={year} years={years} propertyId={propertyId} />
        </div>
        {properties.length > 1 ? (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-sm text-muted-foreground">Property</span>
            <TaxPropertyPicker year={year} propertyId={propertyId} properties={properties} />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Income" value={formatCents(data.totalIncomeCents)} />
        <StatTile label="Deductible" value={formatCents(data.totalDeductibleCents)} />
        <StatTile
          label="Net"
          value={formatCents(data.netCents)}
          accent={data.netCents >= 0 ? 'success' : 'destructive'}
        />
      </div>

      {data.totalNonDeductibleCents > 0 ? (
        <p className="text-xs text-muted-foreground">
          Plus {formatCents(data.totalNonDeductibleCents)} in non-deductible payments (e.g.
          mortgage principal) — tracked but excluded from the deductible total.
        </p>
      ) : null}

      <div className="space-y-1">
        <GenerateReportButton href={generateUrl} year={year} />
        <p className="text-center text-xs text-muted-foreground">
          {selectedAddress ? (
            <>Scoped to {selectedAddress}. </>
          ) : null}
          A single PDF: P&amp;L summary, Schedule E, expense ledger, and every receipt on file.
          Saved below when ready.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deductible expenses by category</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <table className="w-full">
            <tbody>
              {EXPENSE_CATEGORIES.map((c) => (
                <tr key={c} className="border-b last:border-0">
                  <td className="py-2">{c}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCents(categoryTotals[c] ?? 0)}
                  </td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <td className="py-2">Total deductible</td>
                <td className="py-2 text-right tabular-nums">
                  {formatCents(data.totalDeductibleCents)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Link
            href="/landlord/mileage"
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 tap-44"
          >
            <span className="flex items-center gap-3">
              <span className="text-primary" aria-hidden>
                <Car size={20} />
              </span>
              <span className="text-sm">
                <span className="font-medium">Mileage</span>
                <span className="block text-xs text-muted-foreground">
                  Log deductible miles — they roll into Auto and Travel above.
                </span>
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled tax report</CardTitle>
        </CardHeader>
        <CardContent>
          <TaxScheduleSettings
            initialEnabled={profile?.tax_report_enabled ?? false}
            initialMonth={profile?.tax_report_month ?? 2}
            initialDay={profile?.tax_report_day ?? 1}
          />
        </CardContent>
      </Card>

      {reports && reports.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Saved reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(reports as {
              id: string;
              year: number;
              generated_at: string;
              generated_by: string;
              net_cents: number;
              property_label: string | null;
            }[]).map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
              >
                <a
                  href={`/api/tax-reports/${r.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-2 transition hover:opacity-80"
                >
                  <FileText size={16} className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="font-medium">
                      {r.year} tax report
                      {r.property_label ? ` · ${r.property_label}` : ''}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {format(parseISO(r.generated_at), 'MMM d, yyyy')} ·{' '}
                      {r.generated_by === 'scheduled' ? 'scheduled' : 'manual'}
                    </span>
                  </span>
                  <Download size={16} className="ml-auto shrink-0 text-muted-foreground" />
                </a>
                <DeleteTaxReportButton id={r.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        This is a preview, not tax advice. Confirm with your accountant before filing.
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'success' | 'destructive';
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-base font-semibold ${
            accent === 'success' ? 'text-success' : accent === 'destructive' ? 'text-destructive' : ''
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
