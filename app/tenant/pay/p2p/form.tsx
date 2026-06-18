'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { formatCents } from '@/lib/utils';
import { P2P_LABELS, displayHandle, p2pDeepLink, type P2PMethod } from '@/lib/p2p';
import { submitP2PClaim } from './actions';
import { BusyBar } from '@/components/busy-bar';
import type { RentPeriodOption } from '@/lib/rent-period';

interface Props {
  method: P2PMethod;
  handle: string | null;
  leaseId: string;
  amountCents: number;
  expectedDate: string;
  note: string;
  hasPending: boolean;
  periodOptions: RentPeriodOption[];
}

export function P2PClaimForm({
  method,
  handle,
  leaseId,
  amountCents,
  expectedDate,
  note,
  hasPending,
  periodOptions,
}: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(expectedDate);
  const [memo, setMemo] = useState(note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const label = P2P_LABELS[method];
  const deepLink = handle ? p2pDeepLink(method, handle, amountCents, memo) : null;
  const shownHandle = handle ? displayHandle(method, handle) : null;
  const selectedOption = periodOptions.find((o) => o.value === selectedDate);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('lease_id', leaseId);
      fd.set('amount_cents', String(amountCents));
      fd.set('expected_date', selectedDate);
      fd.set('method', method);
      fd.set('note', memo.trim());
      await submitP2PClaim(fd);
      setDone(true);
      setTimeout(() => router.push('/tenant/pay'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function copyHandle() {
    if (!shownHandle) return;
    const ok = await copyToClipboard(shownHandle);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-success">
        Payment logged. Your landlord has been notified and will confirm receipt shortly.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Step 1 — send the money */}
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">Step 1 · Send {formatCents(amountCents)} on {label}</p>

        {shownHandle ? (
          <>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  Your landlord&apos;s {label}
                </p>
                <p className="truncate font-medium">{shownHandle}</p>
              </div>
              <button
                type="button"
                onClick={copyHandle}
                className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs transition hover:bg-muted/50"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {deepLink ? (
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                <ExternalLink size={15} />
                Open {label} to pay {formatCents(amountCents)}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                Open your banking app, send {formatCents(amountCents)} to the {label} above, then
                confirm below.
              </p>
            )}
          </>
        ) : (
          <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            Your landlord hasn&apos;t added their {label} details yet. Ask them for it, send the
            payment, then confirm below — or use a different method.
          </p>
        )}
      </div>

      {/* Step 2 — confirm */}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">Step 2 · Confirm you sent it</p>
        <div className="space-y-1.5">
          <Label htmlFor="period">Paying for</Label>
          <select
            id="period"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}{opt.paid ? ' · paid' : ''}
              </option>
            ))}
          </select>
          {selectedOption?.paid ? (
            <p className="text-xs text-warning">This period already has a payment on record.</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="memo">Note / memo</Label>
          <Textarea
            id="memo"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="e.g. May rent, 123 Main St"
          />
          <p className="text-xs text-muted-foreground">
            The note you included on your {label} payment so your landlord can match it.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={busy || hasPending}>
          {busy
            ? 'Submitting…'
            : hasPending
              ? 'Already submitted'
              : `Notify landlord — I sent this ${label} payment`}
        </Button>
        <BusyBar active={busy} />
      </form>
    </div>
  );
}
