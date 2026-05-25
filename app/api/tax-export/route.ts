import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/server';
import { generateScheduleE, type ScheduleEColumn } from '@/lib/pdf/schedule-e';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

export const runtime = 'nodejs';

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(request.url);
  const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { data: properties } = await supabase
    .from('properties')
    .select('id, address, annual_depreciation_cents')
    .eq('owner_id', user.id)
    .order('created_at');

  const propIds = (properties ?? []).map((p: { id: string }) => p.id);
  if (propIds.length === 0) {
    return NextResponse.json({ error: 'No properties' }, { status: 400 });
  }

  const [{ data: leases }, { data: payments }, { data: expenses }] = await Promise.all([
    supabase.from('leases').select('id, property_id').in('property_id', propIds),
    supabase
      .from('rent_payments')
      .select('lease_id, amount_cents, status, received_date, method')
      .gte('received_date', start)
      .lte('received_date', end),
    supabase
      .from('expenses')
      .select('property_id, date, amount_cents, category, vendor, notes, receipt_url')
      .gte('date', start)
      .lte('date', end)
      .in('property_id', propIds),
  ]);

  const leaseToProperty = new Map<string, string>(
    (leases ?? []).map((l: { id: string; property_id: string }) => [l.id, l.property_id]),
  );

  const cols: ScheduleEColumn[] = (properties ?? []).map(
    (p: {
      id: string;
      address: string;
      annual_depreciation_cents: number | null;
    }) => {
      const incomeCents = (payments ?? [])
        .filter(
          (pay: { lease_id: string; status: string }) =>
            leaseToProperty.get(pay.lease_id) === p.id &&
            (pay.status === 'settled' || pay.status === 'manual'),
        )
        .reduce((s: number, pay: { amount_cents: number }) => s + pay.amount_cents, 0);

      const byCategory: Record<string, number> = {};
      for (const c of EXPENSE_CATEGORIES) byCategory[c] = 0;
      for (const e of (expenses ?? []).filter(
        (x: { property_id: string }) => x.property_id === p.id,
      ) as { category: string; amount_cents: number }[]) {
        byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_cents;
      }

      return {
        address: p.address,
        incomeCents,
        byCategory,
        depreciationCents: p.annual_depreciation_cents ?? 0,
      };
    },
  );

  const scheduleEPdf = generateScheduleE(year, cols);

  // Build the zip
  const zip = new JSZip();
  zip.file('schedule-e.pdf', scheduleEPdf);
  zip.file(
    'expenses.csv',
    toCsv(
      ((expenses ?? []) as Record<string, unknown>[]).map((e) => ({
        date: e.date,
        property_id: e.property_id,
        amount: ((e.amount_cents as number) / 100).toFixed(2),
        category: e.category,
        vendor: e.vendor ?? '',
        notes: e.notes ?? '',
        receipt: e.receipt_url ?? '',
      })),
    ),
  );
  zip.file(
    'rent-payments.csv',
    toCsv(
      ((payments ?? []) as Record<string, unknown>[]).map((p) => ({
        received_date: p.received_date,
        lease_id: p.lease_id,
        amount: ((p.amount_cents as number) / 100).toFixed(2),
        method: p.method ?? '',
        status: p.status,
      })),
    ),
  );

  // Receipt photos
  const receiptUrls = ((expenses ?? []) as { receipt_url: string | null }[])
    .map((e) => e.receipt_url)
    .filter((u): u is string => !!u);
  if (receiptUrls.length > 0) {
    const receiptsFolder = zip.folder('receipts');
    for (const path of receiptUrls) {
      const { data: blob } = await supabase.storage.from('receipts').download(path);
      if (blob) {
        const arr = new Uint8Array(await blob.arrayBuffer());
        receiptsFolder?.file(path.split('/').pop() ?? path, arr);
      }
    }
  }

  zip.file(
    'README.txt',
    `It Rents tax export — ${year}\n\n` +
      `Generated ${new Date().toISOString()}\n\n` +
      `Contents:\n` +
      ` - schedule-e.pdf — IRS Schedule E line-item summary\n` +
      ` - expenses.csv — all deductible expenses for the year\n` +
      ` - rent-payments.csv — all rent received for the year\n` +
      ` - receipts/ — receipt photo originals referenced by expenses.csv\n\n` +
      `This is a preview, not tax advice. Confirm with your accountant.\n`,
  );

  const blob = await zip.generateAsync({ type: 'nodebuffer' });

  return new NextResponse(blob as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="it-rents-tax-${year}.zip"`,
    },
  });
}
