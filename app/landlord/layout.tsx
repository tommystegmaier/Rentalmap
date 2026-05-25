import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TabBar, type TabItem } from '@/components/tab-bar';
import { Home, Building2, Wallet, Wrench, MoreHorizontal } from 'lucide-react';

const tabs: TabItem[] = [
  { href: '/landlord', label: 'Home', icon: <Home size={22} /> },
  { href: '/landlord/properties', label: 'Properties', icon: <Building2 size={22} /> },
  { href: '/landlord/rent', label: 'Rent', icon: <Wallet size={22} /> },
  { href: '/landlord/maintenance', label: 'Maintenance', icon: <Wrench size={22} /> },
  { href: '/landlord/more', label: 'More', icon: <MoreHorizontal size={22} /> },
];

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

  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
      <div className="p-4">{children}</div>
      <TabBar items={tabs} />
    </div>
  );
}
