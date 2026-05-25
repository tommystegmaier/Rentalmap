/**
 * Resize an image client-side so it stays well under the Anthropic 5MB cap,
 * and to keep base64 payload size small. Returns a JPEG Blob.
 *
 * iPhone photos at full resolution easily hit 5–15MB; the OCR doesn't need
 * that fidelity to read a receipt. Sampling at 2000px max + 85% JPEG quality
 * typically yields ~300–800KB while keeping text legible.
 */
export async function resizeForUpload(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {},
): Promise<Blob> {
  const maxDimension = opts.maxDimension ?? 2000;
  const quality = opts.quality ?? 0.85;

  // Bail out gracefully if the browser can't do it — caller should fall back
  // to the original file.
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return file;
  }

  return new Promise<Blob>((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (!w || !h) {
        reject(new Error('Could not read image dimensions'));
        return;
      }

      let targetW = w;
      let targetH = h;
      const longest = Math.max(w, h);
      if (longest > maxDimension) {
        const scale = maxDimension / longest;
        targetW = Math.round(w * scale);
        targetH = Math.round(h * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Could not encode image'));
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image'));
    };

    img.src = objectUrl;
  });
}

/** YYYY-MM-DD validator — guards <input type="date"> from malformed values. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Confirm the date itself is real (no Feb 31 etc).
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime());
}
