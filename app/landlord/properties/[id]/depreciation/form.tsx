'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, MapPin } from 'lucide-react';
import { parseDollarsToCents, formatCents } from '@/lib/utils';
import { prepareScanUpload } from '@/lib/scan-upload';
import { buildDepreciationSchedule } from '@/lib/depreciation';
import { saveDepreciation } from './actions';

function centsToInput(cents: number | null): string {
  return cents != null ? (cents / 100).toFixed(2) : '';
}

interface Props {
  propertyId: string;
  initial: {
    purchase_price_cents: number | null;
    land_value_cents: number | null;
    placed_in_service: string | null;
    depreciation_years: number;
  };
}

export function DepreciationForm({ propertyId, initial }: Props) {
  const router = useRouter();
  const [purchasePrice, setPurchasePrice] = useState(centsToInput(initial.purchase_price_cents));
  const [landValue, setLandValue] = useState(centsToInput(initial.land_value_cents));
  const [placedInService, setPlacedInService] = useState(initial.placed_in_service ?? '');
  const [kind, setKind] = useState<'residential' | 'commercial'>(
    initial.depreciation_years >= 39 ? 'commercial' : 'residential',
  );

  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [landBusy, setLandBusy] = useState(false);
  const [landNote, setLandNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recoveryYears = kind === 'commercial' ? 39 : 27.5;
  const priceCents = parseDollarsToCents(purchasePrice) ?? 0;
  const landCents = parseDollarsToCents(landValue) ?? 0;
  const basisCents = Math.max(0, priceCents - landCents);

  const summary = useMemo(
    () => buildDepreciationSchedule(basisCents, placedInService, recoveryYears),
    [basisCents, placedInService, recoveryYears],
  );

  async function handleScan() {
    if (!file) return;
    setScanning(true);
    try {
      const { blob, filename } = await prepareScanUpload(file);
      const fd = new FormData();
      fd.append('file', blob, filename);
      const res = await fetch('/api/depreciation/scan', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Scan failed');

      if (typeof json.purchasePrice === 'number') setPurchasePrice(json.purchasePrice.toFixed(2));
      if (typeof json.closingDate === 'string' && json.closingDate) setPlacedInService(json.closingDate);
      if (typeof json.landValue === 'number') setLandValue(json.landValue.toFixed(2));
      toast.success('Read from document — review the values before saving.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function findLandValue() {
    if (!priceCents) {
      toast.error('Enter the purchase price first.');
      return;
    }
    setLandBusy(true);
    setLandNote(null);
    try {
      const res = await fetch('/api/depreciation/land-value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.unconfigured) toast.error('Add RENTCAST_API_KEY to enable automatic land lookup.');
        else toast.error(json.error ?? 'Lookup failed');
        return;
      }
      if (!json.available || !json.landRatio) {
        toast.info('No county land assessment found — enter the land value manually.');
        return;
      }
      const land = Math.round(priceCents * json.landRatio);
      setLandValue((land / 100).toFixed(2));
      const pct = (json.landRatio * 100).toFixed(1);
      setLandNote(
        `Using the ${json.assessedYear} county assessment: land is ${pct}% of value, applied to your purchase price.`,
      );
      toast.success('Land value estimated from county assessment.');
    } catch {
      toast.error('Lookup failed');
    } finally {
      setLandBusy(false);
    }
  }

  async function handleSave() {
    if (!summary) {
      toast.error('Enter a purchase price, land value, and date placed in service.');
      return;
    }
    setSaving(true);
    try {
      await saveDepreciation(propertyId, {
        purchase_price_cents: priceCents || null,
        land_value_cents: landCents || null,
        depreciable_basis_cents: basisCents,
        annual_depreciation_cents: summary.annualCents,
        placed_in_service: placedInService || null,
        depreciation_years: recoveryYears,
      });
      toast.success('Depreciation saved');
      router.push(`/landlord/properties/${propertyId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Scan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan a closing statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Upload the settlement statement, closing disclosure, or purchase agreement and AI will
            pull the purchase price and closing date.
          </p>
          <Input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <Button type="button" variant="outline" onClick={handleScan} disabled={scanning} className="w-full">
              <Sparkles size={14} />
              {scanning ? 'Reading document…' : 'Scan document'}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* Inputs */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="price">Purchase price ($)</Label>
          <Input
            id="price"
            inputMode="decimal"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="land">Land value ($) — not depreciable</Label>
          <Input
            id="land"
            inputMode="decimal"
            value={landValue}
            onChange={(e) => {
              setLandValue(e.target.value);
              setLandNote(null);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={findLandValue}
            disabled={landBusy}
          >
            <MapPin size={13} />
            {landBusy ? 'Looking up…' : 'Find land value automatically'}
          </Button>
          {landNote ? <p className="text-xs text-muted-foreground">{landNote}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="placed">Date placed in service</Label>
            <Input
              id="placed"
              type="date"
              value={placedInService}
              onChange={(e) => setPlacedInService(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kind">Property type</Label>
            <Select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'residential' | 'commercial')}
            >
              <option value="residential">Residential (27.5 yr)</option>
              <option value="commercial">Commercial (39 yr)</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calculated depreciation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Depreciable basis" value={formatCents(basisCents)} />
            <Stat label={`Full-year amount`} value={summary ? formatCents(summary.annualCents) : '—'} />
            <Stat
              label={summary ? `First year (${summary.startYear})` : 'First year'}
              value={summary ? formatCents(summary.firstYearCents) : '—'}
            />
            <Stat
              label="Deductible through"
              value={summary ? `${summary.finalYear} · ${summary.totalTaxYears} yrs` : '—'}
            />
          </div>

          {summary ? (
            <details className="rounded-lg border bg-muted/20 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Year-by-year schedule ({summary.totalTaxYears} years)
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {summary.schedule.map((r) => (
                      <tr key={r.year} className="border-b last:border-0">
                        <td className="py-1.5">{r.year}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatCents(r.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : (
            <p className="text-xs text-muted-foreground">
              Enter a purchase price, land value, and date placed in service to see the schedule.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Straight-line MACRS, mid-month convention. {kind === 'residential' ? 'Residential' : 'Commercial'}{' '}
            rental real estate recovers over {recoveryYears} years; the first year is prorated by the
            month placed in service. This is a preview, not tax advice — confirm with your accountant.
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || !summary} className="w-full">
        {saving ? 'Saving…' : 'Save depreciation'}
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold">{value}</p>
    </div>
  );
}
