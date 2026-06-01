'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toggleLateFeeEnabled } from './late-fee-toggle-action';

export function LateFeeToggleButton({
  leaseId,
  propertyId,
  enabled,
}: {
  leaseId: string;
  propertyId: string;
  enabled: boolean;
}) {
  const [optimisticEnabled, setOptimisticEnabled] = useState(enabled);
  const [, startTransition] = useTransition();

  function handleToggle() {
    const next = !optimisticEnabled;
    setOptimisticEnabled(next);
    startTransition(() => toggleLateFeeEnabled(leaseId, propertyId, next));
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={optimisticEnabled ? 'outline' : 'default'}
      onClick={handleToggle}
    >
      {optimisticEnabled ? 'Disable auto fees' : 'Enable auto fees'}
    </Button>
  );
}
