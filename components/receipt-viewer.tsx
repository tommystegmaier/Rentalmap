import { FileText } from 'lucide-react';
import { isPdfReceipt } from '@/lib/receipt';
import { PhotoLightbox } from './photo-lightbox';

export function ReceiptViewer({
  signedUrl,
  path,
  alt = 'Receipt',
}: {
  signedUrl: string;
  path: string | null;
  alt?: string;
}) {
  if (isPdfReceipt(path)) {
    return (
      <a
        href={signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm font-medium text-primary transition hover:bg-muted/50"
      >
        <FileText size={18} className="shrink-0" />
        View receipt (PDF)
      </a>
    );
  }
  return <PhotoLightbox src={signedUrl} alt={alt} />;
}
