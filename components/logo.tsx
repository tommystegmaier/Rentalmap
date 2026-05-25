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
        aria-label="It Rents"
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
          d="M12 32 L32 14 L52 32 V52 H38 V40 H26 V52 H12 Z"
          fill="white"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark ? (
        <span className="text-base font-semibold tracking-tight">It Rents</span>
      ) : null}
    </span>
  );
}
