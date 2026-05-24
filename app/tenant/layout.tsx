import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TabBar, type TabItem } from '@/components/tab-bar';
import { Home, Wallet, Wrench, MoreHorizontal } from 'lucide-react';

const tabs: TabItem[] = [
  { href: '/tenant', label: 'Home', icon: <Home size={22} /> },
  { href: '/tenant/pay', label: 'Pay Rent', icon: <Wallet size={22} /> },
  { href: '/tenant/maintenance', label: 'Maint', icon: <Wrench size={22} /> },
  { href: '/tenant/more', label: 'More', icon: <MoreHorizontal size={22} /> },
];

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

  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
      <div className="p-4">{children}</div>
      <TabBar items={tabs} />
    </div>
  );
}
