import type { SupabaseClient } from '@supabase/supabase-js';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

export interface TaxPropertyColumn {
  id: string;
  address: string;
  incomeCents: number;
  byCategory: Record<string, number>; // deductible expenses only (no depreciation)
  depreciationCents: number;
  nonDeductibleCents: number;
}

export interface TaxExpenseRow {
  date: string;
  propertyAddress: string;
  category: string;
  vendor: string | null;
  amountCents: number;
  deductible: boolean;
  receiptPath: string | null;
}

export interface TaxReportData {
  year: number;
  properties: TaxPropertyColumn[];
  expenses: TaxExpenseRow[];
  totalIncomeCents: number;
  totalDeductibleCents: number; // includes depreciation
  totalNonDeductibleCents: number;
  totalDepreciationCents: number;
  netCents: number;
}

// Aggregates a landlord's income, deductible expenses (by Schedule E category),
// depreciation and non-deductible costs for a tax year. Works with any Supabase
// client — the owner's (RLS-scoped) client for the page/manual download, or the
// service-role client for the scheduled cron.
export async function computeTaxReportData(
  client: SupabaseClient,
  ownerId: string,
  year: number,
): Promise<TaxReportData> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { data: properties } = await client
    .from('properties')
    .select('id, address, annual_depreciation_cents')
    .eq('owner_id', ownerId)
    .order('created_at');

  const propsArr = (properties ?? []) as {
    id: string;
    address: string;
    annual_depreciation_cents: number | null;
  }[];
  const propIds = propsArr.map((p) => p.id);

  const empty: TaxReportData = {
    year,
    properties: [],
    expenses: [],
    totalIncomeCents: 0,
    totalDeductibleCents: 0,
    totalNonDeductibleCents: 0,
    totalDepreciationCents: 0,
    netCents: 0,
  };
  if (propIds.length === 0) return empty;

  const [{ data: leases }, { data: payments }, { data: expenses }] = await Promise.all([
    client.from('leases').select('id, property_id').in('property_id', propIds),
    client
      .from('rent_payments')
      .select('lease_id, amount_cents, status, received_date')
      .gte('received_date', start)
      .lte('received_date', end),
    client
      .from('expenses')
      .select('property_id, date, amount_cents, category, vendor, tax_deductible, receipt_url')
      .gte('date', start)
      .lte('date', end)
      .in('property_id', propIds),
  ]);

  const leaseToProp = new Map<string, string>(
    (leases ?? []).map((l: { id: string; property_id: string }) => [l.id, l.property_id]),
  );
  const addrById = new Map(propsArr.map((p) => [p.id, p.address]));

  type PayRow = { lease_id: string; amount_cents: number; status: string };
  type ExpRow = {
    property_id: string;
    date: string;
    amount_cents: number;
    category: string;
    vendor: string | null;
    tax_deductible: boolean | null;
    receipt_url: string | null;
  };
  const payRows = (payments ?? []) as PayRow[];
  const expRows = (expenses ?? []) as ExpRow[];

  const columns: TaxPropertyColumn[] = propsArr.map((p) => {
    const incomeCents = payRows
      .filter(
        (pay) =>
          leaseToProp.get(pay.lease_id) === p.id &&
          (pay.status === 'settled' || pay.status === 'manual'),
      )
      .reduce((s, pay) => s + pay.amount_cents, 0);

    const byCategory: Record<string, number> = {};
    for (const c of EXPENSE_CATEGORIES) byCategory[c] = 0;
    let nonDeductibleCents = 0;
    for (const e of expRows.filter((x) => x.property_id === p.id)) {
      if (e.tax_deductible === false) {
        nonDeductibleCents += e.amount_cents;
      } else {
        byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_cents;
      }
    }

    return {
      id: p.id,
      address: p.address,
      incomeCents,
      byCategory,
      depreciationCents: p.annual_depreciation_cents ?? 0,
      nonDeductibleCents,
    };
  });

  const expenseRows: TaxExpenseRow[] = expRows
    .map((e) => ({
      date: e.date,
      propertyAddress: addrById.get(e.property_id) ?? '',
      category: e.category,
      vendor: e.vendor,
      amountCents: e.amount_cents,
      deductible: e.tax_deductible !== false,
      receiptPath: e.receipt_url,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const totalIncomeCents = columns.reduce((s, c) => s + c.incomeCents, 0);
  const totalDepreciationCents = columns.reduce((s, c) => s + c.depreciationCents, 0);
  const totalDeductibleCents =
    columns.reduce((s, c) => s + Object.values(c.byCategory).reduce((a, b) => a + b, 0), 0) +
    totalDepreciationCents;
  const totalNonDeductibleCents = columns.reduce((s, c) => s + c.nonDeductibleCents, 0);
  const netCents = totalIncomeCents - totalDeductibleCents;

  return {
    year,
    properties: columns,
    expenses: expenseRows,
    totalIncomeCents,
    totalDeductibleCents,
    totalNonDeductibleCents,
    totalDepreciationCents,
    netCents,
  };
}
