'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { savePaymentHandles } from './actions';

export function PaymentHandles({
  initialVenmo,
  initialCashapp,
  initialZelle,
}: {
  initialVenmo: string;
  initialCashapp: string;
  initialZelle: string;
}) {
  const [venmo, setVenmo] = useState(initialVenmo);
  const [cashapp, setCashapp] = useState(initialCashapp);
  const [zelle, setZelle] = useState(initialZelle);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await savePaymentHandles({
        venmo_handle: venmo,
        cashapp_cashtag: cashapp,
        zelle_handle: zelle,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="venmo">Venmo username</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">@</span>
          <Input
            id="venmo"
            value={venmo}
            onChange={(e) => { setVenmo(e.target.value); setSaved(false); }}
            placeholder="john-doe"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cashapp">Cash App $cashtag</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">$</span>
          <Input
            id="cashapp"
            value={cashapp}
            onChange={(e) => { setCashapp(e.target.value); setSaved(false); }}
            placeholder="johndoe"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Tenants get a one-tap link that opens Cash App with the rent amount pre-filled.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="zelle">Zelle email or phone</Label>
        <Input
          id="zelle"
          value={zelle}
          onChange={(e) => { setZelle(e.target.value); setSaved(false); }}
          placeholder="you@example.com or (555) 123-4567"
        />
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {saved ? <p className="text-xs text-success">Saved.</p> : null}

      <Button onClick={handleSave} disabled={busy} size="sm">
        {busy ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
