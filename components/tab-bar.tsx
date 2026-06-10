'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface TabItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function TabBar({ items }: { items: TabItem[] }) {
  const pathname = usePathname();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(-1);

  const activeIndex = items.findIndex(
    (item) =>
      pathname === item.href ||
      (item.href !== '/landlord' && item.href !== '/tenant' && pathname.startsWith(item.href)),
  );

  // Play squish animation when the active tab changes (skip on first mount)
  useEffect(() => {
    if (prevIndexRef.current !== -1 && prevIndexRef.current !== activeIndex && bubbleRef.current) {
      const el = bubbleRef.current;
      el.style.animation = 'none';
      void el.getBoundingClientRect(); // force reflow to restart animation
      el.style.animation = 'tab-bubble-squish 380ms cubic-bezier(0.34, 1.4, 0.64, 1)';
    }
    prevIndexRef.current = activeIndex;
  }, [activeIndex]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-4"
      style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 4px)' }}
    >
      <nav className="relative mx-auto max-w-md overflow-hidden rounded-full bg-neutral-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {/*
          Bubble wrapper uses inset-x-1 to match the ul's px-1, so
          width: 100%/n correctly sizes to one tab cell.
        */}
        <div className="pointer-events-none absolute inset-x-1 bottom-2 top-2">
          {activeIndex >= 0 && (
            <div
              className="absolute inset-y-0"
              style={{
                width: `${100 / items.length}%`,
                transform: `translateX(${activeIndex * 100}%)`,
                transition: 'transform 380ms cubic-bezier(0.34, 1.2, 0.64, 1)',
              }}
            >
              <div
                ref={bubbleRef}
                className="mx-0.5 h-full rounded-2xl bg-white/[0.15]"
              />
            </div>
          )}
        </div>

        <ul className="relative flex items-center justify-around px-1 py-2">
          {items.map((item, index) => {
            const active = index === activeIndex;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className="flex flex-col items-center justify-center tap-44"
                >
                  <span
                    className={cn(
                      'flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] text-white',
                      active && 'font-medium',
                    )}
                  >
                    <span aria-hidden className="relative">
                      {item.icon}
                      {item.badge && item.badge > 0 ? (
                        <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
