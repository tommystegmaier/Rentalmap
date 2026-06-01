'use client';

import { useTransition } from 'react';
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
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => toggleLateFeeEnabled(leaseId, propertyId, !enabled));
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={enabled ? 'outline' : 'default'}
      disabled={pending}
      onClick={handleToggle}
    >
      {pending ? '…' : enabled ? 'Disable auto fees' : 'Enable auto fees'}
    </Button>
  );
}
