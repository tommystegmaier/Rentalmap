import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SignOutButton } from '@/components/sign-out-button';
import {
  MessageSquare,
  ReceiptText,
  FileText,
  BarChart3,
  Bell,
  Settings,
  UserPlus,
  Download,
  ClipboardList,
  CircleDollarSign,
  Zap,
  Users,
  Wrench,
  ShieldCheck,
  ChevronRight,
  Calculator,
  Car,
} from 'lucide-react';

type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: number };

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Financial',
    items: [
      { href: '/landlord/expenses', label: 'Expenses', icon: <ReceiptText size={20} /> },
      { href: '/landlord/mileage', label: 'Mileage', icon: <Car size={20} /> },
      { href: '/landlord/late-fees', label: 'Late fees', icon: <CircleDollarSign size={20} /> },
      { href: '/landlord/deposits', label: 'Security deposits', icon: <ShieldCheck size={20} /> },
      { href: '/landlord/utilities', label: 'Utilities', icon: <Zap size={20} /> },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/landlord/inspections', label: 'Inspections', icon: <ClipboardList size={20} /> },
      { href: '/landlord/vendors', label: 'Vendors / 1099s', icon: <Wrench size={20} /> },
      { href: '/landlord/reminders', label: 'Reminders', icon: <Bell size={20} /> },
      { href: '/landlord/documents', label: 'Documents', icon: <FileText size={20} /> },
    ],
  },
  {
    title: 'Reports & Account',
    items: [
      { href: '/landlord/tax', label: 'Tax Center', icon: <Calculator size={20} /> },
      { href: '/landlord/reports', label: 'Reports', icon: <BarChart3 size={20} /> },
      { href: '/landlord/owners', label: 'Property owners', icon: <Users size={20} /> },
      { href: '/landlord/invite', label: 'Invite tenant', icon: <UserPlus size={20} /> },
      { href: '/landlord/settings', label: 'Settings', icon: <Settings size={20} /> },
      { href: '/landlord/backup', label: 'Backup / restore', icon: <Download size={20} /> },
    ],
  },
];

export default async function MorePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let unreadMessages = 0;
  if (user) {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null);
    unreadMessages = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="More" />

      {/* Messages — always at top */}
      <Card>
        <CardContent className="p-0">
          <Link
            href="/landlord/messages"
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 tap-44"
          >
            <span className="flex items-center gap-3">
              <span className="text-primary" aria-hidden>
                <MessageSquare size={20} />
              </span>
              <span className="text-sm font-medium">Messages</span>
            </span>
            <span className="flex items-center gap-2">
              {unreadMessages > 0 ? (
                <Badge className="border-transparent bg-primary text-primary-foreground">
                  {unreadMessages}
                </Badge>
              ) : null}
              <ChevronRight size={16} className="text-muted-foreground" />
            </span>
          </Link>
        </CardContent>
      </Card>

      {groups.map((group) => (
        <div key={group.title} className="space-y-1">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.title}
          </p>
          <Card>
            <CardContent className="p-0">
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/30 tap-44"
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-primary" aria-hidden>
                          {item.icon}
                        </span>
                        <span className="text-sm font-medium">{item.label}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ))}

      <div className="flex justify-center">
        <SignOutButton />
      </div>
    </div>
  );
}
