import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { SignOutButton } from '@/components/sign-out-button';
import { FileText, Wallet, User } from 'lucide-react';

const items = [
  { href: '/tenant/lease', label: 'Lease & documents', icon: <FileText size={20} /> },
  { href: '/tenant/payments', label: 'Payment history', icon: <Wallet size={20} /> },
  { href: '/tenant/profile', label: 'Profile', icon: <User size={20} /> },
];

export default function TenantMorePage() {
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
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/30 tap-44"
                >
                  <span className="text-primary" aria-hidden>
                    {it.icon}
                  </span>
                  <span className="text-sm font-medium">{it.label}</span>
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
