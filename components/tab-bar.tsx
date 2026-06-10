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

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-4"
      style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 4px)' }}
    >
      <nav className="mx-auto max-w-md overflow-hidden rounded-full bg-neutral-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <ul className="flex items-center justify-around px-1 py-2">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/landlord' && item.href !== '/tenant' && pathname.startsWith(item.href));
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className="flex flex-col items-center justify-center tap-44"
                >
                  <span
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] text-white transition-colors duration-150',
                      active ? 'bg-white/[0.15] font-medium' : '',
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
