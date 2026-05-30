'use client';

import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type Prefs = {
  rent_reminders?: boolean;
  maintenance_updates?: boolean;
  lease_signing?: boolean;
  inspection_signatures?: boolean;
  messages?: boolean;
};

const ITEMS: Array<{ key: keyof Prefs; label: string; description: string }> = [
  {
    key: 'rent_reminders',
    label: 'Rent reminders',
    description: 'Alerts before and on your rent due date',
  },
  {
    key: 'maintenance_updates',
    label: 'Maintenance updates',
    description: 'Status changes on your work orders',
  },
  {
    key: 'lease_signing',
    label: 'Lease signing',
    description: 'Requests to sign your lease',
  },
  {
    key: 'inspection_signatures',
    label: 'Inspection signatures',
    description: 'Requests to sign inspection reports',
  },
  {
    key: 'messages',
    label: 'Messages',
    description: 'New messages from your landlord',
  },
];

export function TenantNotificationPrefs({ initialPrefs }: { initialPrefs: Prefs }) {
  const defaults: Required<Prefs> = {
    rent_reminders: true,
    maintenance_updates: true,
    lease_signing: true,
    inspection_signatures: true,
    messages: true,
  };
  const [prefs, setPrefs] = useState<Required<Prefs>>({ ...defaults, ...initialPrefs });
  const [isPending, startTransition] = useTransition();

  function toggle(key: keyof Prefs) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    startTransition(async () => {
      await fetch('/api/tenant/notification-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    });
  }

  return (
    <div className="space-y-4">
      {ITEMS.map(({ key, label, description }) => (
        <div key={key} className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Label className="cursor-pointer text-sm font-medium">{label}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Switch
            checked={prefs[key]}
            onCheckedChange={() => toggle(key)}
            disabled={isPending}
          />
        </div>
      ))}
    </div>
  );
}
