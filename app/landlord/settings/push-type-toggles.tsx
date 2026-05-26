'use client';

import { useState } from 'react';

interface Props {
  initialApplianceService: boolean;
  initialHvacFilter: boolean;
  initialMaintenanceRequests: boolean;
  initialMessages: boolean;
}

type Field =
  | 'notify_appliance_service'
  | 'notify_hvac_filter'
  | 'notify_maintenance_requests'
  | 'notify_messages';

export function PushTypeToggles({
  initialApplianceService,
  initialHvacFilter,
  initialMaintenanceRequests,
  initialMessages,
}: Props) {
  const [state, setState] = useState({
    notify_appliance_service: initialApplianceService,
    notify_hvac_filter: initialHvacFilter,
    notify_maintenance_requests: initialMaintenanceRequests,
    notify_messages: initialMessages,
  });
  const [savingField, setSavingField] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(field: Field, next: boolean) {
    setError(null);
    setSavingField(field);
    const prev = state[field];
    setState((s) => ({ ...s, [field]: next }));
    try {
      const res = await fetch('/api/landlord/notification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to save');
      }
    } catch (err) {
      setState((s) => ({ ...s, [field]: prev }));
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSavingField(null);
    }
  }

  const items: { field: Field; title: string; description: string }[] = [
    {
      field: 'notify_maintenance_requests',
      title: 'New maintenance requests',
      description:
        'Push you when a tenant submits a work order. (Emergencies always notify.)',
    },
    {
      field: 'notify_messages',
      title: 'New messages',
      description: 'Push you when a tenant sends you a message.',
    },
    {
      field: 'notify_appliance_service',
      title: 'Appliance service deadlines',
      description:
        'Push you when a scheduled appliance service date arrives (HVAC, water heater, etc.).',
    },
    {
      field: 'notify_hvac_filter',
      title: 'HVAC filter replacement',
      description: 'Push you when an HVAC filter replacement is due.',
    },
  ];

  return (
    <div className="space-y-2 text-sm">
      {items.map((item) => {
        const checked = state[item.field];
        return (
          <label
            key={item.field}
            className="flex items-start gap-3 rounded-lg border p-3"
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={savingField === item.field}
              onChange={(e) => toggle(item.field, e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <div className="flex-1">
              <p className="font-medium">{item.title}</p>
              <p className="text-muted-foreground">{item.description}</p>
            </div>
          </label>
        );
      })}
      {error ? <p className="text-destructive">{error}</p> : null}
    </div>
  );
}
