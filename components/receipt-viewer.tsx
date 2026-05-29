import { FileText } from 'lucide-react';
import { isPdfReceipt } from '@/lib/receipt';

// Renders a stored receipt: an image inline, or a PDF as a tappable link
// (PDFs don't render reliably in <img>/<iframe> on mobile). No hooks, so this
// works in both server and client components.
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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={signedUrl}
      alt={alt}
      className="aspect-video w-full rounded-lg border bg-white object-contain"
      loading="lazy"
    />
  );
}
