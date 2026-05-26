import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Parse ?year= query param; default to prior year (typical filing scenario)
  const url = new URL(request.url);
  const yearParam = url.searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear() - 1;

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  // RLS ensures owner_id = auth.uid()
  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, owner_id, name, address, city, state, zip, ein, ssn_last4, email')
    .eq('id', params.id)
    .maybeSingle();

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

  // Sum expenses for this vendor in the given year
  const { data: expenseRows } = await supabase
    .from('expenses')
    .select('amount_cents')
    .eq('vendor_id', params.id)
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`);

  const totalCents = (expenseRows ?? []).reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0,
  );

  // Pull landlord (payer) info via service role so we can read the users table
  const admin = createServiceRoleClient();
  const { data: landlord } = await admin
    .from('users')
    .select('name, email')
    .eq('id', vendor.owner_id)
    .maybeSingle();

  const pdfBytes = generate1099NEC({
    year,
    payer: {
      name: landlord?.name ?? landlord?.email ?? 'Payer',
      email: landlord?.email ?? null,
    },
    recipient: {
      name: vendor.name,
      ein: vendor.ein as string | null,
      ssnLast4: vendor.ssn_last4 as string | null,
      address: vendor.address as string | null,
      city: vendor.city as string | null,
      state: vendor.state as string | null,
      zip: vendor.zip as string | null,
      email: vendor.email as string | null,
    },
    totalCents,
  });

  const slug = vendor.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="1099-NEC-${slug}-${year}.pdf"`,
    },
  });
}

interface Form1099NECData {
  year: number;
  payer: {
    name: string;
    email: string | null;
  };
  recipient: {
    name: string;
    ein: string | null;
    ssnLast4: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    email: string | null;
  };
  totalCents: number;
}

function generate1099NEC(data: Form1099NECData): Uint8Array {
  const { year, payer, recipient, totalCents } = data;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const left = 56;
  const right = 555;
  let y = 72;

  // ── Title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Form 1099-NEC', left, y);

  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text('Nonemployee Compensation', left, y);

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text(`Tax Year ${year}`, right, y, { align: 'right' });

  y += 20;
  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 20;

  // ── Payer (FILER) ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  doc.text("PAYER'S NAME", left, y);
  y += 12;
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'normal');
  doc.text(payer.name, left, y);
  if (payer.email) {
    y += 14;
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(payer.email, left, y);
  }

  y += 28;
  doc.setDrawColor(220);
  doc.line(left, y, right, y);
  y += 20;

  // ── Recipient ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  doc.text("RECIPIENT'S NAME", left, y);
  y += 12;
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'normal');
  doc.text(recipient.name, left, y);

  // Tax ID
  const taxIdLabel = recipient.ein
    ? `EIN: ${recipient.ein}`
    : recipient.ssnLast4
    ? `SSN: XXX-XX-${recipient.ssnLast4}`
    : 'Tax ID: Not on file';

  doc.setFontSize(10);
  doc.setTextColor(60);
  y += 14;
  doc.text(taxIdLabel, left, y);

  // Address
  const addrParts = [
    recipient.address,
    recipient.city && recipient.state
      ? `${recipient.city}, ${recipient.state} ${recipient.zip ?? ''}`.trim()
      : recipient.city ?? recipient.state,
  ].filter(Boolean);

  for (const part of addrParts) {
    y += 13;
    doc.text(part!, left, y);
  }

  if (recipient.email) {
    y += 13;
    doc.text(recipient.email, left, y);
  }

  y += 28;
  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 24;

  // ── Box 1: Nonemployee Compensation ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20);
  doc.text('Box 1 — Nonemployee Compensation', left, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(22);
  doc.text(`$${(totalCents / 100).toFixed(2)}`, right, y, { align: 'right' });

  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Total paid during the tax year', left, y);

  y += 28;
  doc.setDrawColor(220);
  doc.line(left, y, right, y);
  y += 24;

  // ── Boxes 2–7 (not applicable, show as blank) ──
  const naBoxes = [
    { label: 'Box 2 — Payer made direct sales totaling $5,000 or more', value: '☐ No' },
    { label: 'Box 4 — Federal income tax withheld', value: '$0.00' },
    { label: 'Box 5 — State tax withheld', value: '$0.00' },
    { label: 'Box 6 — State/Payer state no.', value: '—' },
    { label: 'Box 7 — State income', value: '$0.00' },
  ];

  for (const box of naBoxes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80);
    doc.text(box.label, left, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40);
    doc.text(box.value, right, y, { align: 'right' });
    y += 16;
  }

  y += 12;
  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 20;

  // ── Disclaimer ──
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.setFont('helvetica', 'italic');
  const disclaimer =
    'This is not an official IRS form. File electronically at IRS.gov/Filing or use tax software. ' +
    'Verify all amounts before filing. Retain a copy for your records.';
  const disclaimerLines = doc.splitTextToSize(disclaimer, right - left);
  doc.text(disclaimerLines, left, y);

  // ── Footer ──
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160);
  doc.text(`Generated by It Rents · ${new Date().toLocaleDateString()}`, left, 750);

  return doc.output('arraybuffer') as unknown as Uint8Array;
}
