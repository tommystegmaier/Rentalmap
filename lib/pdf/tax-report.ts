import { jsPDF } from 'jspdf';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import type { TaxReportData } from '@/lib/tax-report-data';

function fmt(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Builds the single combined tax-report PDF: cover + P&L summary, Schedule E
// category breakdown, per-property summary, and a full expense ledger.
export function generateTaxReport(data: TaxReportData, ownerLabel: string): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageW - 48;
  let y = 56;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 48) {
      doc.addPage();
      y = 56;
    }
  };

  // ---- Title ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(`Tax Report — ${data.year}`, left, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    `${ownerLabel} · generated ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`,
    left,
    y,
  );
  doc.setTextColor(20);
  y += 28;

  // ---- Profit & Loss summary ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Profit & Loss', left, y);
  y += 8;
  doc.setDrawColor(220);
  doc.line(left, y, right, y);
  y += 18;

  const summaryRows: Array<[string, string, [number, number, number]?]> = [
    ['Total rental income', fmt(data.totalIncomeCents)],
    ['Total deductible expenses', `(${fmt(data.totalDeductibleCents)})`],
    [`  including depreciation`, fmt(data.totalDepreciationCents)],
    ['Net rental income / (loss)', fmt(data.netCents), data.netCents >= 0 ? [22, 130, 60] : [200, 50, 50]],
    ['Non-deductible payments (e.g. mortgage principal)', fmt(data.totalNonDeductibleCents)],
  ];
  doc.setFontSize(11);
  for (const [label, value, color] of summaryRows) {
    ensureSpace(20);
    const bold = label.startsWith('Net') || label.startsWith('Total');
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    if (color) doc.setTextColor(color[0], color[1], color[2]);
    else doc.setTextColor(label.startsWith('  ') ? 120 : 20);
    doc.text(label.trim(), left, y);
    doc.text(value, right, y, { align: 'right' });
    doc.setTextColor(20);
    y += 18;
  }
  y += 12;

  // ---- Schedule E category breakdown (deductible) ----
  ensureSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Deductible expenses by category (Schedule E)', left, y);
  y += 8;
  doc.line(left, y, right, y);
  y += 18;

  const categoryTotals: Record<string, number> = {};
  for (const c of EXPENSE_CATEGORIES) categoryTotals[c] = 0;
  for (const p of data.properties) {
    for (const c of EXPENSE_CATEGORIES) {
      categoryTotals[c] += p.byCategory[c] ?? 0;
    }
  }
  categoryTotals.Depreciation = data.totalDepreciationCents;

  doc.setFontSize(10);
  for (const c of EXPENSE_CATEGORIES) {
    const amt = categoryTotals[c] ?? 0;
    if (amt === 0) continue;
    ensureSpace(16);
    doc.setFont('helvetica', 'normal');
    doc.text(c, left, y);
    doc.text(fmt(amt), right, y, { align: 'right' });
    y += 15;
  }
  ensureSpace(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Total deductible', left, y);
  doc.text(fmt(data.totalDeductibleCents), right, y, { align: 'right' });
  y += 24;

  // ---- Per-property summary ----
  if (data.properties.length > 0) {
    ensureSpace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('By property', left, y);
    y += 8;
    doc.line(left, y, right, y);
    y += 18;
    doc.setFontSize(10);
    for (const p of data.properties) {
      const deductible =
        Object.values(p.byCategory).reduce((a, b) => a + b, 0) + p.depreciationCents;
      const net = p.incomeCents - deductible;
      ensureSpace(34);
      doc.setFont('helvetica', 'bold');
      doc.text(p.address, left, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90);
      doc.text(
        `Income ${fmt(p.incomeCents)}  ·  Deductible ${fmt(deductible)}  ·  Net ${fmt(net)}`,
        left,
        y,
      );
      doc.setTextColor(20);
      y += 18;
    }
    y += 8;
  }

  // ---- Expense ledger ----
  ensureSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Expense ledger', left, y);
  y += 8;
  doc.line(left, y, right, y);
  y += 16;

  const cols = {
    date: left,
    category: left + 70,
    vendor: left + 190,
    ded: right - 110,
    amount: right,
  };
  const header = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(120);
    doc.text('DATE', cols.date, y);
    doc.text('CATEGORY', cols.category, y);
    doc.text('VENDOR', cols.vendor, y);
    doc.text('DED.', cols.ded, y);
    doc.text('AMOUNT', cols.amount, y, { align: 'right' });
    doc.setTextColor(20);
    y += 13;
  };
  header();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (data.expenses.length === 0) {
    doc.setTextColor(120);
    doc.text('No expenses recorded for this year.', left, y);
    doc.setTextColor(20);
    y += 14;
  }
  for (const e of data.expenses) {
    ensureSpace(14);
    if (y === 56) header(); // new page — re-draw header
    doc.text(e.date, cols.date, y);
    doc.text(trunc(e.category, 20), cols.category, y);
    doc.text(trunc(e.vendor ?? '—', 24), cols.vendor, y);
    doc.text(e.deductible ? 'Y' : 'N', cols.ded, y);
    doc.text(fmt(e.amountCents), cols.amount, y, { align: 'right' });
    y += 13;
  }

  // ---- Footer note ----
  ensureSpace(30);
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    'Preview generated by It Rents. Not tax advice — confirm with your accountant before filing.',
    left,
    y,
  );

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}

function trunc(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
