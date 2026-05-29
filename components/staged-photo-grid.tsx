'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// Thumbnail previews of not-yet-uploaded photos, each with a remove button, so
// a wrong pick can be dropped before submitting without starting over.
export function StagedPhotoGrid({
  photos,
  onRemove,
}: {
  photos: File[];
  onRemove: (index: number) => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const made = photos.map((f) => URL.createObjectURL(f));
    setUrls(made);
    return () => made.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo, i) => (
        <div key={`${photo.name}-${photo.lastModified}-${i}`} className="relative">
          {urls[i] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urls[i]}
              alt={`Selected photo ${i + 1}`}
              className="aspect-square w-full rounded-lg border object-cover"
            />
          ) : (
            <div className="aspect-square w-full rounded-lg border bg-muted" />
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove photo"
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
