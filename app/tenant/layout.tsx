import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TabBar, type TabItem } from '@/components/tab-bar';
import { Logo } from '@/components/logo';
import { InstallPrompt } from '@/components/install-prompt';
import { AppBadgeSync } from '@/components/app-badge-sync';
import { TenantPushPrompt } from '@/components/tenant-push-prompt';
import { Home, Wallet, Wrench, MessageSquare, MoreHorizontal } from 'lucide-react';
import { Toaster } from 'sonner';

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
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

  if (profile?.role === 'landlord') redirect('/landlord');

  const { count: unreadMessages } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .is('read_at', null);

  const tabs: TabItem[] = [
    { href: '/tenant', label: 'Home', icon: <Home size={22} /> },
    { href: '/tenant/pay', label: 'Pay Rent', icon: <Wallet size={22} /> },
    { href: '/tenant/maintenance', label: 'Work Orders', icon: <Wrench size={22} /> },
    {
      href: '/tenant/messages',
      label: 'Messages',
      icon: <MessageSquare size={22} />,
      badge: unreadMessages ?? 0,
    },
    { href: '/tenant/more', label: 'More', icon: <MoreHorizontal size={22} /> },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 px-4 pb-3 pt-safe backdrop-blur">
        <Logo size={28} showWordmark />
      </header>
      <AppBadgeSync count={unreadMessages ?? 0} />
      <div className="p-4">{children}</div>
      <TabBar items={tabs} />
      <InstallPrompt />
      <TenantPushPrompt />
      <Toaster richColors position="top-center" />
    </div>
  );
}
