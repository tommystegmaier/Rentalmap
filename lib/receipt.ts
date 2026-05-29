// Lightweight, dependency-free receipt helpers safe to import in server
// components. (PDF generation lives in lib/receipt-pdf.ts, which pulls in
// jsPDF and should only be imported by client code.)

// True if a stored receipt path points at a PDF rather than an image.
export function isPdfReceipt(path: string | null | undefined): boolean {
  return !!path && path.toLowerCase().endsWith('.pdf');
}
