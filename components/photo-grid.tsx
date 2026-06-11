import { PhotoLightbox } from './photo-lightbox';

export function PhotoGrid({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {urls.map((url, i) => (
        <PhotoLightbox
          key={i}
          src={url}
          alt={`Photo ${i + 1}`}
          className="aspect-square w-full rounded-lg border object-cover cursor-zoom-in"
        />
      ))}
    </div>
  );
}
