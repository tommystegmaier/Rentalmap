'use client';

import { useState, useTransition } from 'react';
import { setLateFeeFrequency } from './late-fee-toggle-action';

type Frequency = 'once' | 'weekly' | 'daily';

export function LateFeeFrequencySelect({
  leaseId,
  propertyId,
  frequency,
}: {
  leaseId: string;
  propertyId: string;
  frequency: Frequency;
}) {
  const [value, setValue] = useState<Frequency>(frequency);
  const [, startTransition] = useTransition();

  function handleChange(next: Frequency) {
    setValue(next);
    startTransition(() => setLateFeeFrequency(leaseId, propertyId, next));
  }

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value as Frequency)}
      className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
      aria-label="Late fee frequency"
    >
      <option value="once">Once (flat)</option>
      <option value="weekly">Weekly late</option>
      <option value="daily">Each day late</option>
    </select>
  );
}
