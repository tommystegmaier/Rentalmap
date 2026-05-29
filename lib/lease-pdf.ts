import { jsPDF } from 'jspdf';

export interface LeasePdfData {
  propertyAddress: string;
  startDate: string;
  endDate: string;
  monthlyRentCents: number;
  dueDay: number;
  lateAfterDay: number;
  lateFeeCents: number;
  securityDepositCents: number;
  petsAllowed: boolean;
  utilitiesPaidBy: string;
  lawnCareBy: string;
  termsNotes: string | null;
  landlordSignedAt: string | null;
  landlordSignedName: string | null;
  tenantSignedAt: string | null;
  tenantSignedName: string | null;
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateLeasePdf(lease: LeasePdfData): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 56;
  const right = pageW - 56;
  let y = 64;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 64) {
      doc.addPage();
      y = 64;
    }
  };

  const section = (title: string) => {
    ensureSpace(44);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text(title, left, y);
    y += 6;
    doc.setDrawColor(200);
    doc.line(left, y, right, y);
    y += 16;
  };

  const row = (label: string, value: string) => {
    ensureSpace(22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(label, left, y);
    doc.setTextColor(30);
    doc.text(value, left + 180, y);
    y += 18;
  };

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(20);
  doc.text('Residential Lease Agreement', left, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    `It Rents · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    left,
    y,
  );
  doc.setTextColor(20);
  y += 32;

  // Disclaimer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(120);
  const disclaimer = doc.splitTextToSize(
    'This document was generated from lease data in It Rents. Review with a local attorney to ensure compliance with applicable state and local laws.',
    right - left,
  );
  for (const line of disclaimer) {
    doc.text(line, left, y);
    y += 12;
  }
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20);
  y += 12;

  // Property
  section('Property');
  row('Address', lease.propertyAddress);
  y += 8;

  // Lease Term
  section('Lease Term');
  row('Start date', fmtDate(lease.startDate));
  row('End date', fmtDate(lease.endDate));
  y += 8;

  // Financial Terms
  section('Financial Terms');
  row('Monthly rent', fmt(lease.monthlyRentCents));
  row('Rent due day', `${lease.dueDay} of each month`);
  row('Late fee applies after', `Day ${lease.lateAfterDay} of each month`);
  row('Late fee amount', fmt(lease.lateFeeCents));
  row('Security deposit', fmt(lease.securityDepositCents));
  y += 8;

  // Property Rules
  section('Property Rules & Responsibilities');
  row('Pets', lease.petsAllowed ? 'Allowed' : 'Not allowed');
  row('Utilities paid by', capitalize(lease.utilitiesPaidBy));
  row('Lawn care', capitalize(lease.lawnCareBy));
  y += 8;

  // Custom Terms
  if (lease.termsNotes) {
    section('Additional Terms & Conditions');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(lease.termsNotes, right - left);
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, left, y);
      y += 14;
    }
    y += 8;
  }

  // Signature block
  ensureSpace(160);
  section('Signatures');

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    'By signing below, each party agrees to all terms stated in this lease agreement.',
    left,
    y,
  );
  y += 24;

  // Landlord
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text('LANDLORD', left, y);
  y += 16;
  if (lease.landlordSignedAt && lease.landlordSignedName) {
    doc.setTextColor(22, 130, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`✓ Electronically signed by: ${lease.landlordSignedName}`, left, y);
    y += 14;
    doc.setTextColor(110);
    doc.text(
      `Date: ${new Date(lease.landlordSignedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      left,
      y,
    );
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110);
    doc.text('Signature: _______________________________', left, y);
    y += 14;
    doc.text('Printed name: __________________________', left, y);
    y += 14;
    doc.text('Date: __________________________________', left, y);
  }

  y += 36;

  // Tenant
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text('TENANT', left, y);
  y += 16;
  if (lease.tenantSignedAt && lease.tenantSignedName) {
    doc.setTextColor(22, 130, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`✓ Electronically signed by: ${lease.tenantSignedName}`, left, y);
    y += 14;
    doc.setTextColor(110);
    doc.text(
      `Date: ${new Date(lease.tenantSignedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      left,
      y,
    );
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110);
    doc.text('Signature: _______________________________', left, y);
    y += 14;
    doc.text('Printed name: __________________________', left, y);
    y += 14;
    doc.text('Date: __________________________________', left, y);
  }

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}
