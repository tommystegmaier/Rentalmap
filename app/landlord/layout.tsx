import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TabBar, type TabItem } from '@/components/tab-bar';
import { Logo } from '@/components/logo';
import { HeaderBell } from '@/components/header-bell';
import { AppBadgeSync } from '@/components/app-badge-sync';
import { Home, Building2, Wallet, Wrench, MoreHorizontal } from 'lucide-react';
import { Toaster } from 'sonner';

export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'landlord') {
    redirect('/tenant');
  }

  // Unread counts powering the bell badge + Maintenance/Rent tab badges + app icon badge.
  const [
    { count: unreadNotifications },
    { data: openProperties },
    { count: unreadMessages },
    { count: pendingVenmoClaims },
  ] = await Promise.all([
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)
      .is('dismissed_at', null),
    supabase.from('properties').select('id').eq('owner_id', user.id),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null),
    supabase
      .from('venmo_payment_claims')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  let unreadMaintenance = 0;
  const propIds = (openProperties ?? []).map((p: { id: string }) => p.id);
  if (propIds.length > 0) {
    const { count } = await supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .in('property_id', propIds)
      .is('landlord_viewed_at', null);
    unreadMaintenance = count ?? 0;
  }

  const tabs: TabItem[] = [
    { href: '/landlord', label: 'Home', icon: <Home size={22} /> },
    { href: '/landlord/properties', label: 'Properties', icon: <Building2 size={22} /> },
    { href: '/landlord/rent', label: 'Rent', icon: <Wallet size={22} />, badge: pendingVenmoClaims ?? 0 },
    {
      href: '/landlord/maintenance',
      label: 'Work Orders',
      icon: <Wrench size={22} />,
      badge: unreadMaintenance,
    },
    { href: '/landlord/more', label: 'More', icon: <MoreHorizontal size={22} /> },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 px-4 pb-3 pt-safe backdrop-blur">
        <Logo size={28} showWordmark />
        <div className="flex items-center gap-3">
          <HeaderBell unreadCount={unreadNotifications ?? 0} />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Landlord
          </span>
        </div>
      </header>
      <AppBadgeSync count={(unreadNotifications ?? 0) + (unreadMessages ?? 0)} />
      <div className="p-4">{children}</div>
      <TabBar items={tabs} />
      <Toaster richColors position="top-center" />
    </div>
  );
}
