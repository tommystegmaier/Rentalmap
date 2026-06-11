'use client';
import { useEffect, useRef, useState } from 'react';
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
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [bubble, setBubble] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = items.findIndex(
    (item) =>
      pathname === item.href ||
      (item.href !== '/landlord' && item.href !== '/tenant' && pathname.startsWith(item.href)),
  );

  useEffect(() => {
    function measure() {
      const nav = navRef.current;
      const li = itemRefs.current[activeIndex];
      if (!nav || !li || activeIndex < 0) return;
      const navRect = nav.getBoundingClientRect();
      const liRect = li.getBoundingClientRect();
      setBubble({ left: liRect.left - navRect.left, width: liRect.width });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeIndex]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-4"
      style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 4px)' }}
    >
      <nav
        ref={navRef}
        className="relative mx-auto max-w-md overflow-hidden rounded-full bg-neutral-950/40 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl"
      >
        {/* Bubble positioned from measured li coords — pixel-perfect centering */}
        {bubble && (
          <div
            className="pointer-events-none absolute bottom-2 top-2 rounded-2xl bg-white/[0.15]"
            style={{
              left: bubble.left + 4,
              width: bubble.width - 8,
              transition: 'left 380ms cubic-bezier(0.34, 1.56, 0.64, 1), width 350ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        )}

        <ul className="relative flex items-center px-1 py-2">
          {items.map((item, index) => {
            const active = index === activeIndex;
            return (
              <li
                key={item.href}
                ref={(el) => { itemRefs.current[index] = el; }}
                className="flex-1"
              >
                <Link
                  href={item.href}
                  className="flex w-full flex-col items-center justify-center tap-44"
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
