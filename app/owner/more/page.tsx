import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { SignOutButton } from '@/components/sign-out-button';
import { BarChart3, Building2 } from 'lucide-react';
import Link from 'next/link';

const items = [
  { href: '/owner', label: 'Dashboard', icon: <Building2 size={20} /> },
  { href: '/owner/financials', label: 'Financials', icon: <BarChart3 size={20} /> },
];

export default function OwnerMorePage() {
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
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/30"
                >
                  <span className="text-primary">{it.icon}</span>
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
