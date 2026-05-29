import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTaxReport } from './tax-report';
import type { TaxReportData } from '@/lib/tax-report-data';

// Builds the full tax document packet: the summary report (P&L, Schedule E,
// ledger) followed by every receipt on file for the year, merged into one PDF.
//
// `storage` is any Supabase client able to read the `receipts` bucket — the
// owner's RLS-scoped client (manual download) or the service role (cron).
export async function buildTaxReportPacket(
  storage: SupabaseClient,
  data: TaxReportData,
  ownerLabel: string,
): Promise<Uint8Array> {
  const summaryBytes = generateTaxReport(data, ownerLabel);
  const merged = await PDFDocument.load(summaryBytes);
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const fontBold = await merged.embedFont(StandardFonts.HelveticaBold);

  // One receipt file may back several expense lines (e.g. a mortgage statement
  // split into interest/principal/escrow). Dedupe by path, keep the first
  // expense's details for the caption.
  const seen = new Set<string>();
  const receipts = data.expenses.filter((e) => {
    if (!e.receiptPath || seen.has(e.receiptPath)) return false;
    seen.add(e.receiptPath);
    return true;
  });

  if (receipts.length === 0) return await merged.save();

  // Divider page.
  {
    const page = merged.addPage();
    const { height } = page.getSize();
    page.drawText('Receipts & Documents', { x: 48, y: height - 80, size: 22, font: fontBold });
    page.drawText(
      `${receipts.length} receipt${receipts.length === 1 ? '' : 's'} on file for ${data.year}`,
      { x: 48, y: height - 104, size: 11, font, color: rgb(0.4, 0.4, 0.4) },
    );
  }

  for (const e of receipts) {
    try {
      const { data: blob } = await storage.storage.from('receipts').download(e.receiptPath!);
      if (!blob) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const caption = `${e.date} · ${e.category}${e.vendor ? ` · ${e.vendor}` : ''} · $${(
        e.amountCents / 100
      ).toFixed(2)}`;

      let firstPage: ReturnType<PDFDocument['addPage']> | undefined;

      if (e.receiptPath!.toLowerCase().endsWith('.pdf')) {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach((p, i) => {
          merged.addPage(p);
          if (i === 0) firstPage = p;
        });
      } else {
        // Image receipt (older entries): embed and place on a letter page.
        let img;
        try {
          img = await merged.embedJpg(bytes);
        } catch {
          img = await merged.embedPng(bytes);
        }
        const page = merged.addPage();
        const { width, height } = page.getSize();
        const margin = 36;
        const maxW = width - margin * 2;
        const maxH = height - margin * 2 - 24;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (width - w) / 2, y: (height - h) / 2 - 12, width: w, height: h });
        firstPage = page;
      }

      if (firstPage) {
        const { height } = firstPage.getSize();
        firstPage.drawText(caption, {
          x: 24,
          y: height - 16,
          size: 8,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
      }
    } catch {
      // Skip an unreadable / missing receipt rather than failing the whole packet.
    }
  }

  return await merged.save();
}
