import { PDFDocument } from 'pdf-lib';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function mergeWithUploadedLease(
  admin: SupabaseClient,
  propertyId: string,
  leaseId: string,
  termsBytes: Uint8Array,
): Promise<Uint8Array> {
  // Look for an uploaded lease PDF for this lease (excludes the auto-generated signed copy).
  const { data: docs } = await admin
    .from('documents')
    .select('file_url')
    .eq('property_id', propertyId)
    .eq('lease_id', leaseId)
    .in('type', ['Lease', 'Lease addendum'])
    .neq('filename', 'Signed Lease Agreement.pdf')
    .order('date_added', { ascending: false })
    .limit(1);

  if (!docs?.[0]?.file_url) return termsBytes;

  const { data: fileData } = await admin.storage
    .from('documents')
    .download(docs[0].file_url);

  if (!fileData) return termsBytes;

  try {
    const uploadedBytes = new Uint8Array(await fileData.arrayBuffer());
    const merged = await PDFDocument.create();

    const [uploadedPdf, termsPdf] = await Promise.all([
      PDFDocument.load(uploadedBytes),
      PDFDocument.load(termsBytes),
    ]);

    const uploadedCopies = await merged.copyPages(uploadedPdf, uploadedPdf.getPageIndices());
    for (const page of uploadedCopies) merged.addPage(page);

    const termsCopies = await merged.copyPages(termsPdf, termsPdf.getPageIndices());
    for (const page of termsCopies) merged.addPage(page);

    return merged.save();
  } catch {
    // If merge fails (e.g. encrypted PDF), fall back to terms-only.
    return termsBytes;
  }
}
