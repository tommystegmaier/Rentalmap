import { resizeForUpload } from '@/lib/image';

// Prepares a picked file for the AI scan endpoints. PDFs are sent through
// untouched (with a .pdf filename so the server keeps the application/pdf type
// even when the browser reported an empty MIME type, common on mobile). Images
// are downsized first to stay under the API limit.
export async function prepareScanUpload(
  file: File,
): Promise<{ blob: Blob; filename: string }> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    return { blob: file, filename: 'document.pdf' };
  }

  let blob: Blob = file;
  try {
    blob = await resizeForUpload(file);
  } catch {
    // fall back to the original image
  }
  return { blob, filename: 'upload.jpg' };
}
