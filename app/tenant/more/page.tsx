import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SignOutButton } from '@/components/sign-out-button';
import { MessageSquare, FileText, Wallet, User } from 'lucide-react';

const items = [
  { href: '/tenant/messages', label: 'Messages', icon: <MessageSquare size={20} />, key: 'messages' },
  { href: '/tenant/lease', label: 'Lease & documents', icon: <FileText size={20} /> },
  { href: '/tenant/payments', label: 'Payment history', icon: <Wallet size={20} /> },
  { href: '/tenant/profile', label: 'Profile', icon: <User size={20} /> },
];

export default async function TenantMorePage() {
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
