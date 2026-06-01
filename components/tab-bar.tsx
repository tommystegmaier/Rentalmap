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
      className="fixed inset-x-0 bottom-0 z-50 px-3"
      style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 4px)' }}
    >
      <nav className="mx-auto max-w-md overflow-hidden rounded-2xl border border-border/40 bg-card/95 shadow-2xl backdrop-blur-md">
        <ul className="flex items-stretch justify-around">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/landlord' && item.href !== '/tenant' && pathname.startsWith(item.href));
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-[11px] tap-44 transition-colors duration-150',
                    active ? 'text-foreground' : 'text-muted-foreground/55',
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
                  <span className={cn('max-w-full truncate', active && 'font-medium')}>
                    {item.label}
                  </span>
                  {active && (
                    <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
