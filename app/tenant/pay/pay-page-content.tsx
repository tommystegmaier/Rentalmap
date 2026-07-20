'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO, isAfter } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '@/lib/utils';
import { PayButton } from './pay-button';
import { AutopayControls } from './autopay-controls';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { P2P_METHODS, P2P_LABELS } from '@/lib/p2p';
import type { RentPeriodOption } from '@/lib/rent-period';

type LateFeeRow = { id: string; charge_date: string; amount_cents: number; period_start: string };

interface Props {
  leaseId: string;
  monthlyCents: number;
  baseDueCents: number;
  achTotalCents: number;
  cardTotalCents: number;
  achFeePayer: 'landlord' | 'tenant';
  cardFeePayer: 'landlord' | 'tenant';
  landlordConnected: boolean;
  landlordHasAccount: boolean;
  autopay: { id: string; status: string } | null;
  lateFees: LateFeeRow[];
  periodOptions: RentPeriodOption[];
  defaultExpectedDate: string;
}

export function PayPageContent({
  leaseId,
  monthlyCents,
  baseDueCents,
  achTotalCents,
  cardTotalCents,
  achFeePayer,
  cardFeePayer,
  landlordConnected,
  landlordHasAccount,
  autopay,
  lateFees,
  periodOptions,
  defaultExpectedDate,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(defaultExpectedDate);

  const selectedOption = periodOptions.find((o) => o.value === selectedDate);
  const periodDue = parseISO(selectedDate);
  const payingEarly = isAfter(periodDue, new Date());
  const totalLateFeesCents = lateFees.reduce((s, f) => s + f.amount_cents, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Amount due</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Paying for</p>
            <select
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
          </div>

          <p className="text-3xl font-semibold">{formatCents(baseDueCents)}</p>
          <p className="text-sm text-muted-foreground">
            For {format(periodDue, 'MMMM yyyy')} · due {format(periodDue, 'MMMM d')}
          </p>

          {selectedOption?.paid ? (
            <p className="text-xs text-warning">
              This period already has a payment on record — a duplicate will be created.
            </p>
          ) : payingEarly ? (
            <p className="text-xs text-muted-foreground">
              Paying early — this period isn&apos;t due yet.
            </p>
          ) : null}

          {totalLateFeesCents > 0 ? (
            <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Rent</span>
                <span>{formatCents(monthlyCents)}</span>
              </div>
              <div className="flex items-center justify-between text-destructive">
                <span className="flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  Late fees
                </span>
                <span className="font-medium">{formatCents(totalLateFeesCents)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-destructive/20 pt-1 font-medium">
                <span>Total due</span>
                <span>{formatCents(baseDueCents)}</span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {landlordConnected ? (
        <Card>
          <CardHeader>
            <CardTitle>Pay securely with Stripe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="font-medium">Pay with bank (ACH)</p>
                <p className="text-lg font-semibold">{formatCents(achTotalCents)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {achFeePayer === 'tenant'
                  ? 'Includes a $0.80 processing fee. Settles in 1–3 business days.'
                  : 'No fee for you. Settles in 1–3 business days.'}
              </p>
              <PayButton
                leaseId={leaseId}
                expectedDate={selectedDate}
                method="ach"
                label={`Pay ${formatCents(achTotalCents)} by bank`}
              />
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="font-medium">Card · Apple Pay · Cash App</p>
                <p className="text-lg font-semibold">{formatCents(cardTotalCents)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {cardFeePayer === 'tenant'
                  ? `Includes a 2.9% + $0.30 processing fee (${formatCents(cardTotalCents - baseDueCents)}). Clears immediately. Apple Pay and Cash App available at checkout.`
                  : 'No fee for you. Clears immediately. Apple Pay and Cash App available at checkout.'}
              </p>
              <PayButton
                leaseId={leaseId}
                expectedDate={selectedDate}
                method="card"
                variant="outline"
                label={`Pay ${formatCents(cardTotalCents)} by card / Apple Pay`}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-sm">
            <p className="text-muted-foreground">
              {landlordHasAccount
                ? "Your landlord's payment account is being verified by Stripe and isn't ready yet. Please continue paying via Zelle, Venmo, or check in the meantime."
                : "Your landlord hasn't set up online payments yet. Please continue paying via Zelle, Venmo, or check; payments will be logged here."}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Auto-pay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Authorize Stripe to charge rent automatically each month. Cancel any time.
          </p>
          <AutopayControls
            leaseId={leaseId}
            autopay={autopay}
            landlordConnected={landlordConnected}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="text-sm font-medium">Pay by Venmo, Cash App, or Zelle</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Fee-free. Send the payment, then confirm it here — your landlord approves it and
              it gets logged automatically.
            </p>
          </div>
          <div className="space-y-2">
            {P2P_METHODS.map((m) => (
              <Link
                key={m}
                href={`/tenant/pay/p2p?method=${m}&period=${selectedDate}`}
                className="flex items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition hover:bg-muted/30"
              >
                <span>Pay with {P2P_LABELS[m]}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {lateFees.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle size={18} />
              Outstanding late fees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {lateFees.map((fee) => (
              <div
                key={fee.id}
                className="flex items-center justify-between gap-2 border-b py-2.5 last:border-0"
              >
                <div>
                  <p className="font-medium">{formatCents(fee.amount_cents)}</p>
                  <p className="text-xs text-muted-foreground">
                    Period starting {format(parseISO(fee.period_start), 'MMM d, yyyy')}
                  </p>
                </div>
                <span className="text-xs text-destructive font-medium">Due</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              These are included in your total above and settled with your payment.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
