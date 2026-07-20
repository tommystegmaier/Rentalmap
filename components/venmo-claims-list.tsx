'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { formatCents } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { approveClaim, denyClaim } from '@/app/landlord/rent/claims/actions';
import { P2P_LABELS, type P2PMethod } from '@/lib/p2p';
import { BusyBar } from '@/components/busy-bar';

export interface VenmoClaim {
  id: string;
  amount_cents: number;
  late_fees_cents?: number;
  expected_date: string;
  method: P2PMethod;
  venmo_note: string | null;
  submitted_at: string;
  tenant_name: string | null;
  tenant_email: string | null;
  property_address: string | null;
}

export function VenmoClaimsList({ claims }: { claims: VenmoClaim[] }) {
  if (claims.length === 0) return null;
  return (
    <div className="space-y-2">
      {claims.map((claim) => (
        <VenmoClaimCard key={claim.id} claim={claim} />
      ))}
    </div>
  );
}

function VenmoClaimCard({ claim }: { claim: VenmoClaim }) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [reason, setReason] = useState('');

  const tenantLabel = claim.tenant_name ?? claim.tenant_email ?? 'Tenant';

  async function handleApprove() {
    setBusy('approve');
    try {
      await approveClaim(claim.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve');
      setBusy(null);
    }
  }

  async function handleDeny() {
    setBusy('deny');
    try {
      await denyClaim(claim.id, reason || undefined);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deny');
      setBusy(null);
    }
  }

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-medium">
              {tenantLabel} — {formatCents(claim.amount_cents)}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(claim.expected_date), 'MMMM yyyy')} · submitted{' '}
              {format(parseISO(claim.submitted_at), 'MMM d')}
            </p>
            {claim.late_fees_cents && claim.late_fees_cents > 0 ? (
              <p className="text-xs text-destructive">
                Includes {formatCents(claim.late_fees_cents)} late fees
              </p>
            ) : null}
            {claim.property_address ? (
              <p className="text-xs text-muted-foreground">{claim.property_address}</p>
            ) : null}
            {claim.venmo_note ? (
              <p className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                Note: &ldquo;{claim.venmo_note}&rdquo;
              </p>
            ) : null}
          </div>
          <Badge className="shrink-0 border-transparent bg-warning/10 text-warning">
            {P2P_LABELS[claim.method]} · Pending
          </Badge>
        </div>

        {showDenyForm ? (
          <div className="space-y-2">
            <Textarea
              rows={2}
              placeholder="Reason for denial (optional — sent to tenant)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeny}
                disabled={!!busy}
              >
                {busy === 'deny' ? 'Denying…' : 'Confirm deny'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowDenyForm(false); setReason(''); }}
                disabled={!!busy}
              >
                Cancel
              </Button>
            </div>
            <BusyBar active={busy === 'deny'} />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApprove} disabled={!!busy}>
                {busy === 'approve' ? 'Approving…' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDenyForm(true)}
                disabled={!!busy}
              >
                Deny
              </Button>
            </div>
            <BusyBar active={busy === 'approve'} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
