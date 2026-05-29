import { jsPDF } from 'jspdf';
import { resizeForUpload } from './image';

export interface ReceiptUpload {
  blob: Blob;
  ext: string;
  contentType: string;
}

/**
 * Convert a submitted receipt into a PDF for archival (better for tax records).
 *
 * - Image receipts are placed, centered and scaled to fit, on a single
 *   letter-size page.
 * - Files that are already PDFs pass through unchanged.
 * - On any failure we fall back to uploading the original file so a receipt is
 *   never lost.
 *
 * Runs in the browser (uses canvas via resizeForUpload + an Image element).
 */
export async function receiptToPdf(file: File): Promise<ReceiptUpload> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    return { blob: file, ext: 'pdf', contentType: 'application/pdf' };
  }

  try {
    // Shrink large phone photos first to keep the PDF small.
    let imgBlob: Blob = file;
    try {
      imgBlob = await resizeForUpload(file, { maxDimension: 2200, quality: 0.85 });
    } catch {
      // fall back to the original image
    }

    const dataUrl = await blobToDataUrl(imgBlob);
    const { width, height } = await imageDimensions(dataUrl);

    const pdf = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const scale = Math.min(maxW / width, maxH / height, 1);
    const w = width * scale;
    const h = height * scale;
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;

    pdf.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST');
    const blob = pdf.output('blob');
    return { blob, ext: 'pdf', contentType: 'application/pdf' };
  } catch {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    return { blob: file, ext, contentType: file.type || 'image/jpeg' };
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}

function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = dataUrl;
  });
}
