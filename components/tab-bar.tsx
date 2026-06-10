'use client';
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

  const activeIndex = items.findIndex(
    (item) =>
      pathname === item.href ||
      (item.href !== '/landlord' && item.href !== '/tenant' && pathname.startsWith(item.href)),
  );

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-4"
      style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 4px)' }}
    >
      <nav className="relative mx-auto max-w-md overflow-hidden rounded-full bg-neutral-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {/* Sliding bubble — inset-x-1 matches ul's px-1 so cells align */}
        <div className="pointer-events-none absolute inset-x-1 bottom-2 top-2">
          {activeIndex >= 0 && (
            <div
              className="absolute inset-y-0"
              style={{
                width: `${100 / items.length}%`,
                left: `${(activeIndex / items.length) * 100}%`,
                transition: 'left 350ms ease-in-out',
              }}
            >
              <div className="mx-0.5 h-full rounded-2xl bg-white/[0.15]" />
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
