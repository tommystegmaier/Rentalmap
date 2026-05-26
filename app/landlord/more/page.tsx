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
} from 'lucide-react';

const items = [
  { href: '/landlord/messages', label: 'Messages', icon: <MessageSquare size={20} />, key: 'messages' },
  { href: '/landlord/expenses', label: 'Expenses', icon: <ReceiptText size={20} /> },
  { href: '/landlord/late-fees', label: 'Late fees', icon: <CircleDollarSign size={20} /> },
  { href: '/landlord/deposits', label: 'Security deposits', icon: <ShieldCheck size={20} /> },
  { href: '/landlord/utilities', label: 'Utilities', icon: <Zap size={20} /> },
  { href: '/landlord/inspections', label: 'Inspections', icon: <ClipboardList size={20} /> },
  { href: '/landlord/vendors', label: 'Vendors / 1099s', icon: <Wrench size={20} /> },
  { href: '/landlord/owners', label: 'Property owners', icon: <Users size={20} /> },
  { href: '/landlord/documents', label: 'Documents', icon: <FileText size={20} /> },
  { href: '/landlord/reports', label: 'Reports', icon: <BarChart3 size={20} /> },
  { href: '/landlord/reminders', label: 'Reminders', icon: <Bell size={20} /> },
  { href: '/landlord/invite', label: 'Invite tenant', icon: <UserPlus size={20} /> },
  { href: '/landlord/settings', label: 'Settings', icon: <Settings size={20} /> },
  { href: '/landlord/backup', label: 'Backup / restore', icon: <Download size={20} /> },
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

      <Card>
        <CardContent className="p-0">
          <ul>
            {items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/30 tap-44"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-primary" aria-hidden>
                      {it.icon}
                    </span>
                    <span className="text-sm font-medium">{it.label}</span>
                  </span>
                  {it.key === 'messages' && unreadMessages > 0 ? (
                    <Badge className="border-transparent bg-primary text-primary-foreground">
                      {unreadMessages}
                    </Badge>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <SignOutButton />
      </div>
    </div>
  );
}
