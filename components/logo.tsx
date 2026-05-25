import { cn } from '@/lib/utils';

export function Logo({
  size = 36,
  className,
  showWordmark = false,
}: {
  size?: number;
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role="img"
        aria-label="Rentalmap"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="rm-logo-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7DB9E8" />
            <stop offset="100%" stopColor="#5B9BD5" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#rm-logo-bg)" />
        {/* House */}
        <path
          d="M14 30 L32 14 L50 30 V50 H38 V38 H26 V50 H14 Z"
          fill="white"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Map pin dot above the roof */}
        <circle cx="32" cy="11" r="3.5" fill="white" />
        <path
          d="M32 14.5 L32 18"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {showWordmark ? (
        <span className="text-base font-semibold tracking-tight">Rentalmap</span>
      ) : null}
    </span>
  );
}
