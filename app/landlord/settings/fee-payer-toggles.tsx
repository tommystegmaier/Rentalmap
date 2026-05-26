'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { saveFeePayerSettings } from './actions';

export function FeePayerToggles({
  initialAchFeePayer,
  initialCardFeePayer,
}: {
  initialAchFeePayer: 'landlord' | 'tenant';
  initialCardFeePayer: 'landlord' | 'tenant';
}) {
  const [achFeePayer, setAchFeePayer] = useState(initialAchFeePayer);
  const [cardFeePayer, setCardFeePayer] = useState(initialCardFeePayer);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setBusy(true);
    setSaved(false);
    try {
      await saveFeePayerSettings(achFeePayer, cardFeePayer);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-medium">ACH / bank transfer — $0.80 per payment</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setAchFeePayer('landlord'); setSaved(false); }}
            className={`rounded-lg border px-4 py-2 text-sm transition ${achFeePayer === 'landlord' ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted/50'}`}
          >
            Landlord absorbs
          </button>
          <button
            type="button"
            onClick={() => { setAchFeePayer('tenant'); setSaved(false); }}
            className={`rounded-lg border px-4 py-2 text-sm transition ${achFeePayer === 'tenant' ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted/50'}`}
          >
            Tenant pays
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {achFeePayer === 'tenant'
            ? 'Tenant is charged $0.80 extra on top of rent for bank payments.'
            : 'The $0.80 Stripe fee comes out of your payout.'}
        </p>
      </div>

      <div className="space-y-2">
        <p className="font-medium">Card · Apple Pay · Cash App — 2.9% + $0.30 per payment</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setCardFeePayer('landlord'); setSaved(false); }}
            className={`rounded-lg border px-4 py-2 text-sm transition ${cardFeePayer === 'landlord' ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted/50'}`}
          >
            Landlord absorbs
          </button>
          <button
            type="button"
            onClick={() => { setCardFeePayer('tenant'); setSaved(false); }}
            className={`rounded-lg border px-4 py-2 text-sm transition ${cardFeePayer === 'tenant' ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted/50'}`}
          >
            Tenant pays
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {cardFeePayer === 'tenant'
            ? 'Tenant is charged the fee on top of rent so your payout equals full rent.'
            : 'Tenant is charged just rent; the card fee comes out of your payout.'}
        </p>
      </div>

      {saved ? (
        <p className="text-xs text-success">Saved.</p>
      ) : null}

      <Button onClick={handleSave} disabled={busy} size="sm">
        {busy ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
