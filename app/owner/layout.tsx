import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TabBar, type TabItem } from '@/components/tab-bar';
import { Logo } from '@/components/logo';
import { Home, BarChart3, MoreHorizontal } from 'lucide-react';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
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

  if (!profile || profile.role !== 'owner') {
    redirect('/landlord');
  }

  const tabs: TabItem[] = [
    { href: '/owner', label: 'Dashboard', icon: <Home size={22} /> },
    { href: '/owner/financials', label: 'Financials', icon: <BarChart3 size={22} /> },
    { href: '/owner/more', label: 'More', icon: <MoreHorizontal size={22} /> },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Logo size={28} showWordmark />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Owner
        </span>
      </header>
      <div className="p-4">{children}</div>
      <TabBar items={tabs} />
    </div>
  );
}
