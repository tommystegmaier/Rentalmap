import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { SignOutButton } from '@/components/sign-out-button';
import {
  ReceiptText,
  FileText,
  BarChart3,
  Bell,
  Settings,
  UserPlus,
  Download,
} from 'lucide-react';

const items = [
  { href: '/landlord/expenses', label: 'Expenses', icon: <ReceiptText size={20} /> },
  { href: '/landlord/documents', label: 'Documents', icon: <FileText size={20} /> },
  { href: '/landlord/reports', label: 'Reports', icon: <BarChart3 size={20} /> },
  { href: '/landlord/reminders', label: 'Reminders', icon: <Bell size={20} /> },
  { href: '/landlord/invite', label: 'Invite tenant', icon: <UserPlus size={20} /> },
  { href: '/landlord/settings', label: 'Settings', icon: <Settings size={20} /> },
  { href: '/landlord/backup', label: 'Backup / restore', icon: <Download size={20} /> },
];

export default function MorePage() {
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
