'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  className?: string;
}

export function PhotoLightbox({ src, alt, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className ?? 'aspect-video w-full rounded-lg border bg-white object-contain'}
        loading="lazy"
        onClick={() => setOpen(true)}
        style={{ cursor: 'zoom-in' }}
      />
      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            aria-label="Close photo"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[90dvh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
