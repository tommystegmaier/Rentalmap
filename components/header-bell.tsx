import Link from 'next/link';
import { Bell } from 'lucide-react';

export function HeaderBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link
      href="/landlord/notifications"
      className="relative -m-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground tap-44 hover:text-foreground"
      aria-label={
        unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'
      }
    >
      <Bell size={22} />
      {unreadCount > 0 ? (
        <span className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
