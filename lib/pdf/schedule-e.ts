import { jsPDF } from 'jspdf';

const SCHEDULE_E_LINES: Array<{ line: string; key: string }> = [
  { line: '1a Address', key: '__address' },
  { line: '3  Rents received', key: '__income' },
  { line: '5  Advertising', key: 'Advertising' },
  { line: '6  Auto and Travel', key: 'Auto and Travel' },
  { line: '7  Cleaning and Maintenance', key: 'Cleaning and Maintenance' },
  { line: '8  Commissions', key: 'Commissions' },
  { line: '9  Insurance', key: 'Insurance' },
  { line: '10 Legal and Professional Fees', key: 'Legal and Professional Fees' },
  { line: '11 Management Fees', key: 'Management Fees' },
  { line: '12 Mortgage Interest', key: 'Mortgage Interest' },
  { line: '13 Other Interest', key: 'Other Interest' },
  { line: '14 Repairs', key: 'Repairs' },
  { line: '15 Supplies', key: 'Supplies' },
  { line: '16 Taxes', key: 'Taxes' },
  { line: '17 Utilities', key: 'Utilities' },
  { line: '18 Depreciation', key: 'Depreciation' },
  { line: '19 Other', key: 'Other' },
  { line: '20 Total expenses', key: '__total_expenses' },
  { line: '21 Net rental income / (loss)', key: '__net' },
];

export interface ScheduleEColumn {
  address: string;
  incomeCents: number;
  byCategory: Record<string, number>;
  depreciationCents: number;
}

export function generateScheduleE(year: number, properties: ScheduleEColumn[]): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`Schedule E — Tax year ${year}`, 40, 50);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Preview formatted for IRS Form Schedule E. Not tax advice.', 40, 66);
  doc.setTextColor(20);

  // Column layout
  const labelX = 40;
  const colWidth = 140;
  const startX = 280;
  const headerY = 100;
  const rowH = 18;

  // Headers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  properties.forEach((p, i) => {
    doc.text(`Property ${String.fromCharCode(65 + i)}`, startX + i * colWidth, headerY);
    const lines = doc.splitTextToSize(p.address, colWidth - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(lines, startX + i * colWidth, headerY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
  });

  let y = headerY + 40;
  for (const row of SCHEDULE_E_LINES) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(row.line, labelX, y);

    properties.forEach((p, i) => {
      let value = '';
      if (row.key === '__address') value = '';
      else if (row.key === '__income') value = fmt(p.incomeCents);
      else if (row.key === 'Depreciation') value = fmt(p.depreciationCents);
      else if (row.key === '__total_expenses') {
        const total =
          Object.values(p.byCategory).reduce((s, v) => s + v, 0) + p.depreciationCents;
        value = fmt(total);
      } else if (row.key === '__net') {
        const total =
          Object.values(p.byCategory).reduce((s, v) => s + v, 0) + p.depreciationCents;
        value = fmt(p.incomeCents - total);
      } else {
        value = fmt(p.byCategory[row.key] ?? 0);
      }
      doc.text(value, startX + i * colWidth + colWidth - 8, y, { align: 'right' });
    });
    y += rowH;
  }

  return doc.output('arraybuffer') as unknown as Uint8Array;
}

function fmt(cents: number): string {
  if (cents === 0) return '—';
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
