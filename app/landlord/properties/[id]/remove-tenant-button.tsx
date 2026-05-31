'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { removeTenantFromLease } from './tenants/actions';

export function RemoveTenantButton({
  leaseTenantId,
  propertyId,
  tenantName,
}: {
  leaseTenantId: string;
  propertyId: string;
  tenantName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('lease_tenant_id', leaseTenantId);
      await removeTenantFromLease(propertyId, fd);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X size={12} /> Remove
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <span className="text-xs text-muted-foreground">Remove {tenantName}?</span>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="h-7 text-xs"
        disabled={pending}
        onClick={handleConfirm}
      >
        {pending ? 'Removing…' : 'Yes, remove'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </div>
  );
}
